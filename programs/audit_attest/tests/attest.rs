//! LiteSVM tests for audit_attest. Run: `cargo test -p audit_attest` after `anchor build`.
//! The program binary is loaded from target/deploy/audit_attest.so; these tests never
//! touch a cluster.
use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{bpf_loader_upgradeable, instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SO: &[u8] = include_bytes!("../../../target/deploy/audit_attest.so");

struct Env {
    svm: LiteSVM,
    config: Pubkey,
    program_data: Pubkey,
}

/// Load the program as an upgradeable program whose upgrade authority is `authority`,
/// mirroring a real `anchor deploy`. litesvm's add_program sets the authority to None, so
/// the ProgramData metadata (bincode: variant u32 | slot u64 | Option<Pubkey>) is patched.
fn setup() -> (Env, Keypair, Keypair) {
    let program_id = audit_attest::id();
    let mut svm = LiteSVM::new();
    let authority = Keypair::new();
    let attester = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&attester.pubkey(), 10_000_000_000).unwrap();
    svm.add_program(program_id, SO).unwrap();
    let (program_data, _) = Pubkey::find_program_address(&[program_id.as_ref()], &bpf_loader_upgradeable::id());
    let mut acc = svm.get_account(&program_data).expect("programdata account");
    assert_eq!(&acc.data[..4], &3u32.to_le_bytes(), "expected ProgramData variant");
    acc.data[12] = 1; // Some(...)
    acc.data[13..45].copy_from_slice(authority.pubkey().as_ref());
    svm.set_account(program_data, acc).unwrap();
    let (config, _) = Pubkey::find_program_address(&[audit_attest::CONFIG_SEED], &program_id);
    // LiteSVM's clock starts at unix_timestamp 0; give it a realistic time so the
    // attestation timestamp assertion is meaningful.
    svm.set_sysvar(&Clock { slot: 1, unix_timestamp: 1_757_500_000, ..Default::default() });
    (Env { svm, config, program_data }, authority, attester)
}

fn send(env: &mut Env, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
    let payer = signers[0].pubkey();
    let bh = env.svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    env.svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.err))
}

fn funded(env: &mut Env) -> Keypair {
    let k = Keypair::new();
    env.svm.airdrop(&k.pubkey(), 1_000_000_000).unwrap();
    k
}

fn initialize(env: &mut Env, signer: &Keypair, attester: Pubkey) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        audit_attest::id(),
        &audit_attest::instruction::Initialize { attester }.data(),
        audit_attest::accounts::Initialize {
            config: env.config,
            authority: signer.pubkey(),
            program_data: env.program_data,
            program: audit_attest::id(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(env, ix, &[signer])
}

fn args(report: u8) -> audit_attest::AttestArgs {
    let mut corpus = [0u8; 32];
    corpus[..13].copy_from_slice(b"7.3.0@6bb2cbf");
    let mut model = [0u8; 32];
    model[..13].copy_from_slice(b"claude-opus-5");
    audit_attest::AttestArgs {
        repo_hash: [1u8; 32],
        commit_sha: [2u8; 20],
        corpus_version: corpus,
        model_id: model,
        report_sha256: [report; 32],
        counts: [1, 2, 3, 4, 5],
        visibility: 2,
    }
}

fn pda(a: &audit_attest::AttestArgs) -> Pubkey {
    Pubkey::find_program_address(&[audit_attest::ATTEST_SEED, &a.repo_hash, &a.commit_sha], &audit_attest::id()).0
}

fn attest(env: &mut Env, signer: &Keypair, a: audit_attest::AttestArgs) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        audit_attest::id(),
        &audit_attest::instruction::Attest { args: a.clone() }.data(),
        audit_attest::accounts::Attest { config: env.config, attestation: pda(&a), attester: signer.pubkey(), system_program: system_program::ID }.to_account_metas(None),
    );
    send(env, ix, &[signer])
}

fn reattest(env: &mut Env, signer: &Keypair, key: Pubkey, a: audit_attest::AttestArgs) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        audit_attest::id(),
        &audit_attest::instruction::Reattest { args: a }.data(),
        audit_attest::accounts::Reattest { config: env.config, attestation: key, attester: signer.pubkey() }.to_account_metas(None),
    );
    send(env, ix, &[signer])
}

fn set_visibility(env: &mut Env, signer: &Keypair, key: Pubkey, visibility: u8) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        audit_attest::id(),
        &audit_attest::instruction::SetVisibility { visibility }.data(),
        audit_attest::accounts::Reattest { config: env.config, attestation: key, attester: signer.pubkey() }.to_account_metas(None),
    );
    send(env, ix, &[signer])
}

fn set_attester(env: &mut Env, signer: &Keypair, attester: Pubkey) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        audit_attest::id(),
        &audit_attest::instruction::SetAttester { attester }.data(),
        audit_attest::accounts::SetAttester { config: env.config, authority: signer.pubkey() }.to_account_metas(None),
    );
    send(env, ix, &[signer])
}

fn read(env: &Env, key: Pubkey) -> audit_attest::Attestation {
    let acc = env.svm.get_account(&key).expect("account exists");
    audit_attest::Attestation::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

#[test]
fn only_upgrade_authority_can_initialize() {
    let (mut env, authority, attester) = setup();
    let stranger = funded(&mut env);
    assert!(initialize(&mut env, &stranger, attester.pubkey()).is_err(), "stranger must not initialize");
    initialize(&mut env, &authority, attester.pubkey()).expect("authority initializes");
    assert!(initialize(&mut env, &authority, attester.pubkey()).is_err(), "second initialize must fail");
}

#[test]
fn attest_writes_hashes_and_counts_and_rejects_strangers() {
    let (mut env, authority, attester) = setup();
    initialize(&mut env, &authority, attester.pubkey()).unwrap();

    let stranger = funded(&mut env);
    assert!(attest(&mut env, &stranger, args(9)).is_err(), "non-attester must not attest");

    attest(&mut env, &attester, args(9)).expect("attester attests");
    let a = read(&env, pda(&args(9)));
    assert_eq!(a.repo_hash, [1u8; 32]);
    assert_eq!(a.commit_sha, [2u8; 20]);
    assert_eq!(a.report_sha256, [9u8; 32]);
    assert_eq!(a.counts, [1, 2, 3, 4, 5]);
    assert_eq!(a.visibility, 2);
    assert_eq!(a.attester, attester.pubkey());
    assert_eq!(&a.corpus_version[..13], b"7.3.0@6bb2cbf");
    assert_eq!(&a.model_id[..13], b"claude-opus-5");
    assert_eq!(a.timestamp, 1_757_500_000);

    // Same (repo, commit) cannot be attested twice via `attest`.
    assert!(attest(&mut env, &attester, args(7)).is_err(), "duplicate attest must fail");

    // Account size matches the TypeScript client's ATTESTATION_ACCOUNT_SIZE.
    let acc = env.svm.get_account(&pda(&args(9))).unwrap();
    assert_eq!(acc.data.len(), 8 + 32 + 20 + 32 + 32 + 32 + 5 + 1 + 8 + 32 + 1);

    // Invalid visibility is rejected.
    let mut bad = args(1);
    bad.commit_sha = [3u8; 20];
    bad.visibility = 3;
    assert!(attest(&mut env, &attester, bad).is_err(), "visibility > 2 rejected");
}

#[test]
fn reattest_and_visibility_are_attester_only() {
    let (mut env, authority, attester) = setup();
    initialize(&mut env, &authority, attester.pubkey()).unwrap();
    attest(&mut env, &attester, args(9)).unwrap();
    let key = pda(&args(9));

    let stranger = funded(&mut env);
    assert!(reattest(&mut env, &stranger, key, args(3)).is_err());
    reattest(&mut env, &attester, key, args(3)).expect("attester reattests");
    assert_eq!(read(&env, key).report_sha256, [3u8; 32]);

    assert!(set_visibility(&mut env, &stranger, key, 1).is_err());
    assert!(set_visibility(&mut env, &attester, key, 7).is_err(), "visibility > 2 rejected");
    set_visibility(&mut env, &attester, key, 1).unwrap();
    assert_eq!(read(&env, key).visibility, 1);
}

#[test]
fn authority_can_rotate_attester() {
    let (mut env, authority, attester) = setup();
    initialize(&mut env, &authority, attester.pubkey()).unwrap();
    let new_attester = funded(&mut env);
    assert!(set_attester(&mut env, &attester, new_attester.pubkey()).is_err(), "attester cannot rotate itself");
    set_attester(&mut env, &authority, new_attester.pubkey()).unwrap();
    assert!(attest(&mut env, &attester, args(1)).is_err(), "old attester locked out");
    attest(&mut env, &new_attester, args(1)).expect("new attester works");
}

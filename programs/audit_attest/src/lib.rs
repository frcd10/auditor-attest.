//! audit_attest — one PDA per (repo, commit) binding an AI security audit to its inputs.
//!
//! Only hashes and counts ever go on-chain. Finding text never does.
//! Writes are restricted to the `attester` key stored in the single `Config` PDA, which
//! the program's upgrade authority initialises once and may rotate.
use anchor_lang::prelude::*;

declare_id!("sXtvdoheTtFBukx8vCppJHhiiJHW2xa3xc5KaPAhzkC");

pub const CONFIG_SEED: &[u8] = b"config";
pub const ATTEST_SEED: &[u8] = b"attest";

#[program]
pub mod audit_attest {
    use super::*;

    /// One-time setup by the program's upgrade authority: who may write attestations.
    pub fn initialize(ctx: Context<Initialize>, attester: Pubkey) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.attester = attester;
        c.bump = ctx.bumps.config;
        Ok(())
    }

    /// Rotate the attester key (authority only).
    pub fn set_attester(ctx: Context<SetAttester>, attester: Pubkey) -> Result<()> {
        ctx.accounts.config.attester = attester;
        Ok(())
    }

    /// Create the (repo, commit) attestation. Fails if one already exists.
    pub fn attest(ctx: Context<Attest>, args: AttestArgs) -> Result<()> {
        let bump = ctx.bumps.attestation;
        let a = &mut ctx.accounts.attestation;
        a.write(&args, ctx.accounts.attester.key(), bump)?;
        emit!(Attested { attestation: a.key(), repo_hash: a.repo_hash, commit_sha: a.commit_sha, report_sha256: a.report_sha256 });
        Ok(())
    }

    /// Replace hash/counts of an existing attestation (a re-run on the same commit).
    pub fn reattest(ctx: Context<Reattest>, args: AttestArgs) -> Result<()> {
        let bump = ctx.accounts.attestation.bump;
        let a = &mut ctx.accounts.attestation;
        a.write(&args, ctx.accounts.attester.key(), bump)?;
        emit!(Attested { attestation: a.key(), repo_hash: a.repo_hash, commit_sha: a.commit_sha, report_sha256: a.report_sha256 });
        Ok(())
    }

    /// Disclosure state changed off-chain: 0 private, 1 public, 2 public_redacted.
    pub fn set_visibility(ctx: Context<Reattest>, visibility: u8) -> Result<()> {
        require!(visibility <= 2, AttestError::InvalidVisibility);
        ctx.accounts.attestation.visibility = visibility;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AttestArgs {
    pub repo_hash: [u8; 32],      // sha256(lowercase canonical repo url)
    pub commit_sha: [u8; 20],     // raw git sha
    pub corpus_version: [u8; 32], // e.g. "7.3.0@6bb2cbf", zero-padded
    pub model_id: [u8; 32],       // e.g. "claude-opus-5", zero-padded
    pub report_sha256: [u8; 32],  // sha256(report.md)
    pub counts: [u8; 5],          // critical, high, medium, low, info
    pub visibility: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub attester: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Attestation {
    pub repo_hash: [u8; 32],
    pub commit_sha: [u8; 20],
    pub corpus_version: [u8; 32],
    pub model_id: [u8; 32],
    pub report_sha256: [u8; 32],
    pub counts: [u8; 5],
    pub visibility: u8,
    pub timestamp: i64,
    pub attester: Pubkey,
    pub bump: u8,
}

impl Attestation {
    fn write(&mut self, args: &AttestArgs, attester: Pubkey, bump: u8) -> Result<()> {
        require!(args.visibility <= 2, AttestError::InvalidVisibility);
        self.repo_hash = args.repo_hash;
        self.commit_sha = args.commit_sha;
        self.corpus_version = args.corpus_version;
        self.model_id = args.model_id;
        self.report_sha256 = args.report_sha256;
        self.counts = args.counts;
        self.visibility = args.visibility;
        self.timestamp = Clock::get()?.unix_timestamp;
        self.attester = attester;
        self.bump = bump;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// The program's ProgramData account; proves `authority` is the upgrade authority.
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ AttestError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ AttestError::Unauthorized)]
    pub program: Program<'info, crate::program::AuditAttest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAttester<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AttestError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(args: AttestArgs)]
pub struct Attest<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = attester @ AttestError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(init, payer = attester, space = 8 + Attestation::INIT_SPACE, seeds = [ATTEST_SEED, args.repo_hash.as_ref(), args.commit_sha.as_ref()], bump)]
    pub attestation: Account<'info, Attestation>,
    #[account(mut)]
    pub attester: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Reattest<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = attester @ AttestError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [ATTEST_SEED, attestation.repo_hash.as_ref(), attestation.commit_sha.as_ref()], bump = attestation.bump)]
    pub attestation: Account<'info, Attestation>,
    pub attester: Signer<'info>,
}

#[event]
pub struct Attested {
    pub attestation: Pubkey,
    pub repo_hash: [u8; 32],
    pub commit_sha: [u8; 20],
    pub report_sha256: [u8; 32],
}

#[error_code]
pub enum AttestError {
    #[msg("signer is not authorised for this action")]
    Unauthorized,
    #[msg("visibility must be 0 (private), 1 (public) or 2 (public_redacted)")]
    InvalidVisibility,
}

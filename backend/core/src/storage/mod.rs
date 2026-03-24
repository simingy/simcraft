pub mod memory;
#[cfg(feature = "web")]
pub mod sqlite;
#[cfg(feature = "postgres")]
pub mod postgres;

use crate::models::{Job, JobStatus};

/// Trait for job persistence — implemented by in-memory store (desktop) and SQLite (web).
pub trait JobStorage: Send + Sync {
    fn insert(&self, job: Job);
    fn get(&self, id: &str) -> Option<Job>;
    fn list(&self) -> Vec<Job>;
    fn update_status(&self, id: &str, status: JobStatus);
    fn update_progress(&self, id: &str, pct: u8, stage: &str, detail: &str);
    fn complete_stage(&self, id: &str, summary: &str);
    fn set_result(&self, id: &str, result: String);
    fn set_error(&self, id: &str, error: String);
    fn append_log(&self, id: &str, line: &str);
    fn get_logs(&self, id: &str) -> Vec<String>;
}

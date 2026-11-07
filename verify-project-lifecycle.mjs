// Run the complete lifecycle suite with its explicit host and production dependencies.
// The lifecycle owner temporarily observes the host Blob prototype. Wait for
// it to restore that observer before sibling focus fixtures hash their Blobs.
await import('./verify-project-lifecycle-full.mjs');
await import('./verify-workflow-focus.mjs');

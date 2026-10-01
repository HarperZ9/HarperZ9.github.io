# Privacy

Plexus runs on the user's computer. The publisher operates no backend for this package.
The connected client and its model can see tool arguments and results under that client's terms.
No model is included. Any model endpoint configured by the user belongs to that user.
Local access is granted to the running process by the operating system; a client permission dialog is not an OS sandbox.
Do not connect private stores or directories to an untrusted client. Stop the client process to disconnect.

## What it reads, stores and sends

Plexus reads its built-in tool manifests and, when a call names one, a folder of
`*.interop.json` manifests. It stores nothing, opens no network connection and starts
no process.

## Retention and support

Plexus keeps no data after a call returns. Support and security reports:
https://github.com/HarperZ9/plexus/issues

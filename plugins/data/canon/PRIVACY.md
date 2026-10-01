# Local context and privacy

Canon reads the database and scope explicitly selected at launch. With the ingestion grant enabled, it stores supplied context in that database. Query and get return selected stored content to the connected client. The client's model provider and privacy policy determine how that client handles results.

Canon's client package supplies no telemetry, hosted storage, network listener or model compute. Context content is untrusted data. Secret scrubbing reduces accidental exposure but does not establish that content is safe to share. Review sensitive inputs and retrieved material before sending them to a provider.

Stored data persists until the owner removes it through a separate authorized workflow. This client does not expose purge. Backups, exported results and provider copies are outside its removal boundary. Scope IDs are selectors, not authentication. Filesystem permissions and the host account remain part of the security boundary.

## Retention and support

Canon keeps no copy of your data outside the database you selected. Content stays in
that database until you remove it with Canon's purge command or delete the file.
Canon sends nothing over a network and collects no usage statistics.

Support and security reports: https://github.com/HarperZ9/canon/issues

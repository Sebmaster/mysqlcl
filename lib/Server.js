function Server() {}

Server.prototype.protocolVersion = null;

Server.prototype.serverVersion = null;

Server.prototype.threadNr = null;

Server.prototype.capabilities = 0;

Server.prototype.charset = null;

Server.prototype.status = null;

Server.Capabilities = {
	LONG_PASSWORD:		1,		/* new more secure passwords */
	FOUND_ROWS:			2,		/* Found instead of affected rows */
	LONG_FLAG:			4,		/* Get all column flags */
	CONNECT_WITH_DB:		8,		/* One can specify db on connect */
	NO_SCHEMA:			16,		/* Don't allow database.table.column */
	COMPRESS:			32,		/* Can use compression protocol */
	ODBC:				64,		/* Odbc client */
	LOCAL_FILES:			128,	/* Can use LOAD DATA LOCAL */
	IGNORE_SPACE:		256,	/* Ignore spaces before '(' */
	PROTOCOL_41:			512,	/* New 4.1 protocol */
	INTERACTIVE:			1024,	/* This is an interactive client */
	SSL:					2048,	/* Switch to SSL after handshake */
	IGNORE_SIGPIPE:		4096,	/* IGNORE sigpipes */
	TRANSACTIONS:		8192,	/* Client knows about transactions */
	RESERVED:			16384,	/* Old flag for 4.1 protocol  */
	SECURE_CONNECTION:	32768,	/* New 4.1 authentication */
	MULTI_STATEMENTS:	65536,	/* Enable/disable multi-stmt support */
	MULTI_RESULTS:		131072	/* Enable/disable multi-results */
};

Server.defaultCapabilities =
	Server.Capabilities.LONG_PASSWORD
  | Server.Capabilities.FOUND_ROWS
  | Server.Capabilities.LONG_FLAG
  | Server.Capabilities.CONNECT_WITH_DB
  | Server.Capabilities.ODBC
  | Server.Capabilities.LOCAL_FILES
  | Server.Capabilities.IGNORE_SPACE
  | Server.Capabilities.PROTOCOL_41
  | Server.Capabilities.INTERACTIVE
  | Server.Capabilities.IGNORE_SIGPIPE
  | Server.Capabilities.TRANSACTIONS
  | Server.Capabilities.RESERVED
  | Server.Capabilities.SECURE_CONNECTION
  | Server.Capabilities.MULTI_STATEMENTS
  | Server.Capabilities.MULTI_RESULTS;

exports.Server = Server;
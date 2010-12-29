function Server() {}

Server.prototype.protocolVersion = null;

Server.prototype.serverVersion = null;

Server.prototype.threadNr = null;

Server.prototype.capabilities = 0;

Server.prototype.charset = null;

Server.prototype.status = null;

Server.Capabilities = {
	CLIENT_LONG_PASSWORD:		1,		/* new more secure passwords */
	CLIENT_FOUND_ROWS:			2,		/* Found instead of affected rows */
	CLIENT_LONG_FLAG:			4,		/* Get all column flags */
	CLIENT_CONNECT_WITH_DB:		8,		/* One can specify db on connect */
	CLIENT_NO_SCHEMA:			16,		/* Don't allow database.table.column */
	CLIENT_COMPRESS:			32,		/* Can use compression protocol */
	CLIENT_ODBC:				64,		/* Odbc client */
	CLIENT_LOCAL_FILES:			128,	/* Can use LOAD DATA LOCAL */
	CLIENT_IGNORE_SPACE:		256,	/* Ignore spaces before '(' */
	CLIENT_PROTOCOL_41:			512,	/* New 4.1 protocol */
	CLIENT_INTERACTIVE:			1024,	/* This is an interactive client */
	CLIENT_SSL:					2048,	/* Switch to SSL after handshake */
	CLIENT_IGNORE_SIGPIPE:		4096,	/* IGNORE sigpipes */
	CLIENT_TRANSACTIONS:		8192,	/* Client knows about transactions */
	CLIENT_RESERVED:			16384,	/* Old flag for 4.1 protocol  */
	CLIENT_SECURE_CONNECTION:	32768,	/* New 4.1 authentication */
	CLIENT_MULTI_STATEMENTS:	65536,	/* Enable/disable multi-stmt support */
	CLIENT_MULTI_RESULTS:		131072	/* Enable/disable multi-results */
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
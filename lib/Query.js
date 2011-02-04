/**
 * Implements a nice API to handle Querys.
 *
 * @constructor
 */
function Query(cmd, connection) {
	var cmd = null;
	var disabledCommandBuilder = false;
	var queryData = {};
	
	this.__defineGetter__("queryData", function() {
        return queryData;
    });
	
	this.__defineGetter__("disabledCommandBuilder", function() {
        return disabledCommandBuilder;
    });
   
    this.__defineSetter__("disabledCommandBuilder", function(val) {
    	if (val === false) {
    		cmd = null;
    	}
        disabledCommandBuilder = false;
    });
	
	this.__defineGetter__("cmd", function() {
        return cmd;
    });
   
    this.__defineSetter__("cmd", function(val) {
    	if (cmd === null) {
    		disabledCommandBuilder = false;
    		return;
    	}
        cmd = val;
        disabledCommandBuilder = true;
    });
    
	this.cmd = cmd ? cmd : null;
	this.connection = connection;
}

/**
 * Contains the connection to the database.
 * 
 * @type {Connection}
 */
Query.prototype.connection = null;

/**
 * The id of the prepared statement.
 * 
 * @type {Object.<string, *>}
 */
Query.prototype.prepareInfo = null;

/**
 * Contains all the query data.
 * 
 * @type {Object.<string, *>}
 */
Query.prototype.queryData = null;

/**
 * Contains the command to execute.
 * 
 * @type {string}
 */
Query.prototype.cmd = null;

/**
 * Disables the command builder.
 * 
 * @type {boolean}
 */
Query.prototype.disabledCommandBuilder = false;

/**
 * Builds the mysql command.
 * 
 * @return {?string}
 */
Query.prototype.createQuery = function() {
	if (this.disabledCommandBuilder === false) {
		return null;
	}
	return '';
};

/**
 * Executes a query in the database.
 */
Query.prototype.execute = function() {
	if (this.cmd === null) {
		this.cmd = this.createQuery();
	}
	
};

/**
 * Returns the query.
 * 
 * @nosideeffects
 * @return {string}
 */
Query.prototype.toString = function() {
	if (this.cmd === null) {
		return this.createQuery();
	}
	return this.cmd;
};

exports.Query = Query;
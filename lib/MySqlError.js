var inherits = require("util").inherits;

/**
 * A MySQL error
 * 
 * @constructor
 * @extends Error
 * @param {number} no the number of the error
 * @param {string} state the sql state
 * @param {string} message the error message
 */
function MySqlError(no, state, message) {
	this.no = no;
	this.state = state;
	this.message = message;
};

inherits(MySqlError, Error);

MySqlError.__proto__ = Error.prototype;

/**
 * A error number
 * 
 * @type {number}
 */
MySqlError.prototype.no = 0;

/**
 * A MySQL state
 * 
 * @type {string}
 */
MySqlError.prototype.state = null;

/**
 * A error message
 * 
 * @type {string}
 */
MySqlError.prototype.message = null;

/**
 * Returns a string representation of the error.
 * Includes the error number and the error message.
 */
MySqlError.prototype.toString = function() {
	return "MySqlError " + this.no + ": " + this.message;
};

exports.MySqlError = MySqlError;
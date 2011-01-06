var inherits = require('util').inherits;

function MySqlError(no, state, message) {
	this.no = no;
	this.state = state;
	this.message = message;
};

MySqlError.prototype.no = 0;

MySqlError.prototype.state = null;

MySqlError.prototype.message = null;

MySqlError.prototype.toString = function() {
	return 'MySqlError '+this.no+': '+this.message;
};

inherits(MySqlError, Error);

MySqlError.__proto__ = Error.prototype;

exports.MySqlError = MySqlError;
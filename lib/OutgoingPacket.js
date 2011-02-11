/**
 * An outgoing packet.
 * 
 * @constructor
 */
function OutgoingPacket() {
	this.data = [0, 0, 0, 0];
}

/**
 * A data array.
 * 
 * @type {Array.<*>}
 */
OutgoingPacket.prototype.data = null;

/**
 * Writes 0x00-bytes to the data array.
 * 
 * @param {number} bytes the number of bytes to write
 */
OutgoingPacket.prototype.writeFiller = function(bytes) {
	for (var i=0; i < bytes; ++i) {
		this.data[this.data.length] = 0;
	}
};

/**
 * Writes a number with a fixed length to the data array.
 * 
 * @param {number} num the number
 * @param {number} bytes the length
 */
OutgoingPacket.prototype.writeFixedNumber = function(num, bytes) {
	this.data[this.data.length] = num & 255;
	for (var i=0; i < bytes-1; ++i) {
		num >>= 8;
		this.data[this.data.length] = num & 255;
	}
};

/**
 * Writes a number as a length coded binary number to the data array.
 * 
 * @param {number} num the number
 */
OutgoingPacket.prototype.writeLCB = function(num) {
	if (num >= 0 && num < 251) {
		this.data[this.data.length] = num;
	} else if (num === null) {
		this.data[this.data.length] = 251;
	} else {
		if (num > 255 && num < 65536) { // 16bit word
			this.data[this.data.length] = 252;
			this.data[this.data.length] = num & 255;
			this.data[this.data.length] = (num >> 8) & 255;
		} else if (num > 65535 && num < 16777216) { // 24bit word
			this.data[this.data.length] = 253;
			this.data[this.data.length] = num & 255;
			this.data[this.data.length] = (num >>= 8) & 255;
			this.data[this.data.length] = (num >> 8) & 255;
		} else { // 64bit word
			this.data[this.data.length] = 254;
			this.data[this.data.length] = num & 255;
			this.data[this.data.length] = (num >>= 8) & 255;
			this.data[this.data.length] = (num >>= 8) & 255;
			this.data[this.data.length] = (num >>= 8) & 255;
			this.data[this.data.length] = (num >>= 8) & 255;
			this.data[this.data.length] = (num >>= 8) & 255;
			this.data[this.data.length] = (num >>= 8) & 255;
			this.data[this.data.length] = (num >> 8) & 255;
		}
	}
};

/**
 * Writes a string to the data array.
 * 
 * @param {string} str the string
 * @param {boolean} noNull Should the null be omitted
 */
OutgoingPacket.prototype.writeString = function(str, noNull) {
	for (var i=0; i < str.length; ++i) {
		this.data[this.data.length] = str.charCodeAt(i) & 255;
	}
	if (!noNull) {
		this.data[this.data.length] = 0;
	}
};

/**
 * Writes a length coded binary string to the data array.
 * 
 * @param {string} str the string
 */
OutgoingPacket.prototype.writeLengthString = function(str) {
	this.writeLCB(str.length);
	for (var i=0; i < str.length; ++i) {
		this.data[this.data.length] = str.charCodeAt(i) & 255;
	}
};

/**
 * Returns a Buffer object of the current data.
 * 
 * @nosideeffects
 * @param {number} packetNo the number of the packet
 * @return {Buffer} the buffer to write
 */
OutgoingPacket.prototype.getBuffer = function(packetNo) {
	var length = this.data.length - 4;
	this.data[0] = length & 255;
	this.data[1] = (length >> 8) & 255;
	this.data[2] = length >> 16;
	this.data[3] = packetNo;
	return new Buffer(this.data);
};

exports.OutgoingPacket = OutgoingPacket;
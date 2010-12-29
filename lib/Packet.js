function Packet(buffer) {
	this.length = (buffer[2] << 16) + (buffer[1] << 8) + buffer[0];
	this.nr = buffer[3];
	this.data = buffer.slice(4, buffer.length);
}

/**
 * The length of the data part of the packet
 * 
 * @type {number}
 */
Packet.prototype.length = null;

/**
 * The number of the packet
 * 
 * @type {number}
 */
Packet.prototype.nr = null;

/**
 * The data of the packet
 * 
 * @type {Buffer}
 */
Packet.prototype.data = null;

/**
 * Gets a string until a null termination.
 * 
 * @param {Buffer} buffer the buffer
 * @param {number} start the start index
 * @param {string} encoding the encoding of the string
 */
Packet.prototype.getNullString = function(start, indexWrapper, encoding) {
	if (!encoding) encoding = 'utf-8';
	for (var i=start; i < this.data.length; ++i) {
		if (this.data[i] == 0) {
			indexWrapper.index = i;
			return this.data.toString(encoding, start, i);
		}
	}
	indexWrapper.index = i;
	return this.data.toString(encoding, start, i);
};

exports.Packet = Packet;
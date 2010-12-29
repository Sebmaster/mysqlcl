function OutgoingPacket() {}

OutgoingPacket.prototype.data = [];

OutgoingPacket.prototype.writeFiller = function(bytes) {
	for (var i=0; i < bytes; ++i) {
		this.data[this.data.length] = 0;
	}
};

OutgoingPacket.prototype.writeFixedNumber = function(num, bytes) {
	this.data[this.data.length] = num & 255;
	for (var i=0; i < bytes-1; ++i) {
		this.data[this.data.length] = (num >> 8 * Math.pow(2, i)) & 255;
	}
};

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
			this.data[this.data.length] = (num >> 8) & 255;
			this.data[this.data.length] = (num >> 16) & 255;
		} else { // 64bit word
			this.data[this.data.length] = 254;
			this.data[this.data.length] = num & 255;
			this.data[this.data.length] = (num >> 8) & 255;
			this.data[this.data.length] = (num >> 16) & 255;
			this.data[this.data.length] = (num >> 24) & 255;
			this.data[this.data.length] = (num >> 32) & 255;
			this.data[this.data.length] = (num >> 40) & 255;
			this.data[this.data.length] = (num >> 48) & 255;
			this.data[this.data.length] = (num >> 56) & 255;
		}
	}
};

OutgoingPacket.prototype.writeNullString = function(str) {
	for (var i=0; i < str.length; ++i) {
		this.data[this.data.length] = str.charCodeAt(i) & 255;
	}
	this.data[this.data.length] = 0;
};
OutgoingPacket.prototype.writeLengthString = function(str) {
	this.writeLCB(str.length);
	for (var i=0; i < str.length; ++i) {
		this.data[this.data.length] = str.charCodeAt(i) & 255;
	}
};

OutgoingPacket.prototype.getBuffer = function() {
	var arr = [];
	for (var i=0; i < this.data.length; ++i) {
		arr[arr.length] = this.data[i];
	}
	var header = [0, 0, 0, 1];
	header[0] = arr.length & 255;
	header[1] = (arr.length >> 8) & 255;
	header[2] = (arr.length >> 16) & 255;
	arr.splice(0, 0, header[0], header[1], header[2], header[3]);
	return new Buffer(arr);
};

exports.OutgoingPacket = OutgoingPacket;
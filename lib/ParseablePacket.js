function ParseablePacket(packet) {
	var indexWrapper = {index: 0};
	this.fieldCount = packet.getFixedNumber(indexWrapper, 1);
	switch (this.fieldCount) {
		case 0x00:
			break;
		case 0xFF:
			this.errNo = packet.getFixedNumber(indexWrapper, 2);
			break;
	}
}

ParseablePacket.prototype.fieldCount = null;

ParseablePacket.prototype.errNo = null;

exports.ParseablePacket = ParseablePacket;
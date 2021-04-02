import {v4} from 'uuid';

export class Util {
	private constructor() {
		throw new Error(`This class can't be initialized.`)
	}

	public static generateId() {
		return v4()
	}

	public static stringToByte(str: string): Buffer {
		return Buffer.from(str);
	}

	public static bytesToString(bytes: Uint8Array) {
		const chars = [];
		for(let i = 0, n = bytes.length; i < n;) {
			chars.push(((bytes[i++] & 0xff) << 8) | (bytes[i++] & 0xff));
		}
		return String.fromCharCode.apply(null, chars);
	}
}

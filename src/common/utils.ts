import { v4 } from 'uuid';

export class Utils {
  private constructor() {
    throw new Error(`This class can't be initialized.`);
  }

  public static uuid() {
    return v4();
  }

  public static stringToBytes(str: string): Buffer {
    return Buffer.from(str);
  }

  public static bytesToString(bytes: Uint8Array | string) {
    if (typeof bytes === 'string') {
      return bytes;
    }
    return String.fromCharCode.apply(null, bytes);
  }
}

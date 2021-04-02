export class Settings {
  public clientId = '';
  public;

  setClientId(value: string): Settings {
    this.clientId = value;
    return this;
  }

  get address(): string {
    return this._address;
  }
  constructor(protected _address: string) {}
}

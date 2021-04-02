export class CommandRequest {
	public RequestID = undefined;
	public Metadata = undefined;
	public Timeout = undefined;
	public Tags = undefined;
	constructor(public Body: Buffer) {}
}

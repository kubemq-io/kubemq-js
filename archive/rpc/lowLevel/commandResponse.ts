// https://github.com/kubemq-io/kubemq-node/blob/master/rpc/lowLevel/commandResponse.js
export class CommandResponse {
	public RequestID = this.request.RequestID;
	public ReplyChannel = this.request.ReplyChannel;
	public CacheHit = this.request.CacheHit;
	public Timestamp = this.request.TimeStamp;
	public Error = this.request.Error;
	public Tags = undefined;
	constructor(private request: any, public Executed: boolean) {}
}

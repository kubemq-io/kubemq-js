import { PubSub } from '../pubsub';
import { PubSubSettings } from '../../interfaces';
import { Event, Result } from '../../../src/protos/generated';

export class Publisher extends PubSub {
  constructor(settings: PubSubSettings) {
    super(settings);
  }

  send(event: Event): Promise<Result> {
    return super.send(event);
  }
}

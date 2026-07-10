import { VideoEventType } from '@validators/VideoEventEnvelopeValidator';
import { queueName } from '../amqp/AmqpTopology';

export const SubscribersConfig = Object.freeze({
  VideoProcessingRequested: {
    consumerName: 'processor.on-video-processing-requested',
    queueName: queueName('processor', VideoEventType.VideoProcessingRequested),
    eventType: VideoEventType.VideoProcessingRequested,
  },
});

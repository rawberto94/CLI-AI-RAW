declare module "bullmq" {
  export const Queue: any;
  export const Worker: any;
  export const QueueEvents: any;
  export const FlowProducer: any;
  const BullMQ: any;
  export default BullMQ;
}

declare module "ioredis" {
  const Redis: any;
  export default Redis;
}

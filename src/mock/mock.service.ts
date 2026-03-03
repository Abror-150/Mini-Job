import { Injectable } from '@nestjs/common';

@Injectable()
export class MockService {
  async processTask(
    taskPayload: any,
  ): Promise<{ status: string; data: string }> {
    const delay = Math.floor(Math.random() * 3000) + 2000; // Random delay between 2-5 seconds
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, delay));

    const randomResult = Math.random() < 0.75 ? 'success' : 'failure'; // estimated success 75% of the time

    if (randomResult === 'success') {
      return {
        status: 'success',
        data: `Processed task with payload: ${JSON.stringify(taskPayload)}`,
      };
    } else {
      throw new Error(
        `Failed to process task with payload: ${JSON.stringify(taskPayload)}`,
      );
    }
  }
}

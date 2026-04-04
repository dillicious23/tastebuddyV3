import { MockData } from './mock-data';

describe('MockData', () => {
  it('should create an instance', () => {
    const directive = new MockData();
    expect(directive).toBeTruthy();
  });
});

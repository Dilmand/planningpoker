describe('Simple test suite', () => {
  test('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });
  
  test('should handle string operations', () => {
    expect('hello' + ' world').toBe('hello world');
  });
});
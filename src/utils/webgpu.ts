type NavigatorWithGPU = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<{ readonly limits: unknown } | null>;
  };
};

/** Returns true when WebGPU is available and an adapter can be acquired. */
export async function checkWebGPUSupport(timeoutMs = 8000): Promise<boolean> {
  const gpu = (navigator as NavigatorWithGPU).gpu;
  if (typeof navigator === 'undefined' || !gpu) return false;

  try {
    const adapter = await Promise.race([
      gpu.requestAdapter(),
      new Promise<null>((_, reject) => {
        window.setTimeout(() => reject(new Error('WebGPU adapter request timed out')), timeoutMs);
      }),
    ]);
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Docker URL Utilities
 *
 * Helpers for normalizing URLs when running inside Docker containers.
 * Converts localhost/127.0.0.1 to host.docker.internal so the browser
 * inside Docker can reach services on the host machine.
 */

/**
 * Normalize URL for Docker execution
 * Converts localhost URLs to host.docker.internal so browser inside Docker can reach host machine
 *
 * @param url - The URL to normalize (with or without protocol)
 * @returns The normalized URL with host.docker.internal if it was localhost
 *
 * @example
 * normalizeUrlForDocker('localhost:3000') // => 'http://host.docker.internal:3000/'
 * normalizeUrlForDocker('http://localhost:8080/path') // => 'http://host.docker.internal:8080/path'
 * normalizeUrlForDocker('127.0.0.1:5000') // => 'http://host.docker.internal:5000/'
 * normalizeUrlForDocker('https://example.com') // => 'https://example.com/' (unchanged)
 */
export function normalizeUrlForDocker(url: string): string {
  if (!url) return url;

  try {
    // Add protocol if missing
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'http://' + normalizedUrl;
    }

    const urlObj = new URL(normalizedUrl);

    // Convert localhost/127.0.0.1 to host.docker.internal for Docker compatibility
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      urlObj.hostname = 'host.docker.internal';
      return urlObj.toString();
    }

    return normalizedUrl;
  } catch {
    // If URL parsing fails, try simple string replacement
    return url
      .replace(/^localhost:/, 'http://host.docker.internal:')
      .replace(/^127\.0\.0\.1:/, 'http://host.docker.internal:')
      .replace('://localhost:', '://host.docker.internal:')
      .replace('://127.0.0.1:', '://host.docker.internal:');
  }
}

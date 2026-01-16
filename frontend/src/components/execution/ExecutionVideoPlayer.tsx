import React, { useState, useRef, useEffect } from 'react';

interface ExecutionVideoPlayerProps {
  executionId: string;
  testName: string;
  videoPath?: string;
  thumbnailPath?: string;
  seekToTimestamp?: number | null; // Timestamp in seconds
}

export function ExecutionVideoPlayer({ executionId, testName, videoPath, thumbnailPath, seekToTimestamp }: ExecutionVideoPlayerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Seek when seekToTimestamp changes
  useEffect(() => {
    if (videoRef.current && seekToTimestamp !== null && seekToTimestamp !== undefined) {
      videoRef.current.currentTime = seekToTimestamp;
      // Optional: Auto-play on seek? Maybe not.
    }
  }, [seekToTimestamp]);

  // Use environment variable for API URL
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  const videoUrl = `${API_URL}/api/execution/${executionId}/video`;
  const thumbnailUrl = `${API_URL}/api/execution/${executionId}/video/thumbnail`;
  const downloadUrl = `${API_URL}/api/execution/${executionId}/video/download`;

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => {
          console.error('Playback failed:', e);
          setError('Failed to play video. Format might not be supported.');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleError = () => {
    setError('Video file not found or format not supported.');
  };

  if (!videoPath) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow border overflow-hidden mb-6">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h3 className="font-semibold text-gray-800 flex items-center">
          <span className="mr-2">🎥</span> Execution Recording
        </h3>
        <a 
          href={downloadUrl} 
          download 
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="mr-1">⬇️</span> Download
        </a>
      </div>
      
      <div className="relative bg-black aspect-video flex items-center justify-center">
        {error ? (
          <div className="text-center p-8">
            <div className="text-red-500 text-4xl mb-2">⚠️</div>
            <p className="text-gray-300">{error}</p>
            <p className="text-gray-500 text-sm mt-2">Try downloading the file to play locally.</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full"
            controls
            poster={thumbnailPath ? thumbnailUrl : undefined}
            onError={handleError}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={videoUrl} type="video/webm" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>
      
      <div className="p-3 bg-gray-50 text-xs text-gray-500 flex justify-between">
        <span>Format: WebM (VP8/VP9)</span>
        <span>Resolution: 1920x1080</span>
      </div>
    </div>
  );
}
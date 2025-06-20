'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { isValidYouTubeUrl } from '../lib/utils';
import { Youtube, AlertCircle, Loader2 } from 'lucide-react';

interface VideoInputProps {
  onProcess: (url: string) => void;
  isProcessing: boolean;
}

export default function VideoInput({ onProcess, isProcessing }: VideoInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    onProcess(url);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto premium-card shadow-xl border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl font-bold">
          <Youtube className="w-7 h-7 text-[#FF0033] animate-bounce-slow" />
          <span className="gradient-accent bg-clip-text text-transparent">Extract Knowledge from YouTube Video</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <Input
              id="youtube-url"
              type="url"
              placeholder=" "
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessing}
              className={
                'peer h-14 px-4 pt-6 pb-2 text-lg rounded-xl border-2 border-transparent focus:border-[#FF0033] focus:ring-2 focus:ring-[#FF0033]/20 transition-all bg-white/80 shadow-md font-medium' +
                (error ? ' border-[#FF0033] focus:border-[#FF0033] focus:ring-[#FF0033]/20' : '')
              }
            />
            <Label
              htmlFor="youtube-url"
              className="absolute left-4 top-4 text-gray-500 text-base font-semibold pointer-events-none transition-all duration-200 peer-focus:-translate-y-3 peer-focus:scale-90 peer-focus:text-[#FF0033] peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100"
            >
              YouTube Video URL
            </Label>
            {error && (
              <div className="flex items-center gap-2 text-[#FF0033] text-sm mt-2 animate-shake">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
          <Button 
            type="submit" 
            disabled={isProcessing || !url.trim()}
            className="w-full py-4 text-lg font-bold gradient-accent shadow-lg hover:scale-[1.03] active:scale-95 transition-all duration-200"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin w-5 h-5" />
                Processing Video...
              </span>
            ) : (
              <span>Extract Knowledge</span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

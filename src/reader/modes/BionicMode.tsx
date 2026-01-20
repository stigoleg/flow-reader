import { bionicText, adaptiveBionicText, bionicTextShadow } from '@/lib/bionic';

interface BionicModeProps {
  text: string;
  intensity: number;
  proportion: number;
  adaptive?: boolean;
}

export default function BionicMode({ text, intensity, proportion, adaptive = false }: BionicModeProps) {
  const words = adaptive 
    ? adaptiveBionicText(text, proportion) 
    : bionicText(text, proportion);
  // Use text-shadow instead of font-weight to create bold appearance
  // This prevents layout shifts when toggling bionic mode
  const textShadow = bionicTextShadow(intensity);

  return (
    <>
      {words.map((word, index) => (
        <span key={index}>
          {word.bold && (
            <span className="bionic-bold" style={{ textShadow }}>
              {word.bold}
            </span>
          )}
          {word.regular}
        </span>
      ))}
    </>
  );
}

import { bionicText, bionicFontWeight } from '@/lib/bionic';

interface BionicModeProps {
  text: string;
  intensity: number;
  proportion: number;
}

export default function BionicMode({ text, intensity, proportion }: BionicModeProps) {
  const words = bionicText(text, proportion);
  const fontWeight = bionicFontWeight(intensity);

  return (
    <>
      {words.map((word, index) => (
        <span key={index}>
          {word.bold && (
            <span className="bionic-bold" style={{ fontWeight }}>
              {word.bold}
            </span>
          )}
          {word.regular}
        </span>
      ))}
    </>
  );
}

import { memo, useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { pointerEventsStyles } from '../../pointerEvents';

/** A bolted shelf bracket with a beveled rail and two arms supporting the tank's lower collar. */
export const TeaTankMount = memo(function TeaTankMount({ width, height }: { width: number; height: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={width} height={height} viewBox="0 0 120 28" style={pointerEventsStyles.none}>
      <Defs>
        <LinearGradient id={`mount-steel-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor="#E9E0CE" />
          <Stop offset="0.22" stopColor="#B9C4CD" />
          <Stop offset="0.52" stopColor="#8793A3" />
          <Stop offset="1" stopColor="#485467" />
        </LinearGradient>
        <LinearGradient id={`mount-plate-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#D8D7CD" />
          <Stop offset="0.45" stopColor="#8B97A8" />
          <Stop offset="1" stopColor="#536073" />
        </LinearGradient>
        <LinearGradient id={`mount-bolt-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#FFF2D4" />
          <Stop offset="0.45" stopColor="#CDD5DA" />
          <Stop offset="1" stopColor="#748292" />
        </LinearGradient>
      </Defs>
      {/* A narrow contact shadow seats the hardware against the wooden shelf face. */}
      <Ellipse cx={60} cy={25} rx={57} ry={2.5} fill="#5D321F" opacity={0.22} />
      {[0, 100].map((x) => (
        <G key={x} transform={`translate(${x} 0)`}>
          <Rect x={3} y={3} width={17} height={22} rx={3} fill="#513725" opacity={0.22} />
          <Rect x={1} y={1} width={17} height={23} rx={3} fill={`url(#mount-plate-${uid})`} stroke="#39485C" strokeWidth={1.3} />
          <Path d="M4 3 H14 M3 5 V20" fill="none" stroke="#EEE7D6" strokeWidth={0.9} opacity={0.8} />
          {[6, 19].map((y) => (
            <G key={y}>
              <Circle cx={10} cy={y + 0.7} r={3.2} fill="#364456" />
              <Circle cx={9.5} cy={y} r={2.5} fill={`url(#mount-bolt-${uid})`} />
              <Path d={`M8 ${y + 0.7} L11 ${y - 0.7}`} stroke="#576272" strokeWidth={0.8} strokeLinecap="round" />
            </G>
          ))}
        </G>
      ))}
      {/* Top bevel, front face and the darker underside give the rail actual thickness. */}
      <Path d="M16 12 L22 8 H98 L104 12 Z" fill="#D2D5CC" stroke="#657286" strokeWidth={0.8} />
      <Rect x={15} y={12} width={90} height={9} rx={2} fill={`url(#mount-steel-${uid})`} stroke="#39485C" strokeWidth={1.2} />
      <Path d="M18 13 H102" stroke="#FFF0D6" strokeWidth={1.1} strokeLinecap="round" />
      <Path d="M18 20 H102" stroke="#303D51" strokeWidth={1} strokeLinecap="round" />
      <Path d="M22 16 H98 M25 17.5 H95" stroke="#C5CBD0" strokeWidth={0.4} opacity={0.4} />
      {/* Bent cradle arms disappear behind the tank collar; they never cross its tap. */}
      <Path d="M15 9 L22 12 L27 21 H21 L14 15 Z M105 9 L98 12 L93 21 H99 L106 15 Z"
        fill={`url(#mount-steel-${uid})`} stroke="#39485C" strokeWidth={1} strokeLinejoin="round" />
      <Path d="M16 10 L22 13 L25 19 M104 10 L98 13 L95 19" fill="none" stroke="#E7E4D6" strokeWidth={0.9} strokeLinecap="round" />
    </Svg>
  );
});

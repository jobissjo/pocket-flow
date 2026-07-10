import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Defs, Filter, FeGaussianBlur } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface BackgroundBlobsProps {
  isDark: boolean;
}

export function BackgroundBlobs({ isDark }: BackgroundBlobsProps) {
  return (
    <Svg height="100%" width="100%" style={styles.absolute} pointerEvents="none">
      <Defs>
        <Filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
          <FeGaussianBlur stdDeviation="80" />
        </Filter>
      </Defs>
      {isDark ? (
        <>
          {/* Dark Mode Glowing Accents */}
          <Circle cx={width * 0.1} cy={height * 0.25} r="160" fill="#291a5e" filter="url(#blur)" opacity="0.65" />
          <Circle cx={width * 0.9} cy={height * 0.65} r="180" fill="#142e5d" filter="url(#blur)" opacity="0.6" />
          <Circle cx={width * 0.4} cy={height * 0.85} r="140" fill="#1f1430" filter="url(#blur)" opacity="0.5" />
        </>
      ) : (
        <>
          {/* Light Mode Soft Pastel Accents */}
          <Circle cx={width * 0.1} cy={height * 0.2} r="160" fill="#ebedff" filter="url(#blur)" opacity="0.75" />
          <Circle cx={width * 0.9} cy={height * 0.6} r="180" fill="#e1f3ff" filter="url(#blur)" opacity="0.75" />
          <Circle cx={width * 0.4} cy={height * 0.9} r="140" fill="#f8e5ff" filter="url(#blur)" opacity="0.6" />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});

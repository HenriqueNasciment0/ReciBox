// src/components/LogoComponent.js
import Svg, { G, Path, Rect, Text } from 'react-native-svg';

const LogoComponent = (props) => (
  <Svg width={150} viewBox="0 0 100 125" {...props}>
    <G>
      <Path
        d="M20 20H80C82.7614 20 85 22.2386 85 25V65C85 67.7614 82.7614 70 80 70H20C17.2386 70 15 67.7614 15 65V25C15 22.2386 17.2386 20 20 20Z"
        fill="#3b82f6"
      />
      <Path d="M25 10H75V30H25V10Z" fill="#93c5fd" />
      <Path d="M30 15H70V20H30V15Z" fill="#dbeafe" />
      <Rect x="25" y="40" width="20" height="5" rx="2.5" fill="#ffffff" />
      <Rect x="55" y="40" width="20" height="5" rx="2.5" fill="#dbeafe" />
      <Rect x="25" y="50" width="50" height="5" rx="2.5" fill="#dbeafe" />
    </G>
    <Text
      x="50"
      y="95"
      fontFamily="Inter, sans-serif"
      fontSize="16"
      fontWeight="bold"
      textAnchor="middle"
      fill="#1f2937"
    >
      ReciBox
    </Text>
  </Svg>
);

export default LogoComponent;

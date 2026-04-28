import React from 'react';
import { Box, Text, useTheme } from 'src/ink.js';
import { env } from '../../utils/env.ts';

const WELCOME_V2_WIDTH = 58;

type AppleTerminalWelcomeV2Props = {
  theme: string;
  welcomeMessage: string;
};

function AppleTerminalWelcomeV2({ theme, welcomeMessage }: AppleTerminalWelcomeV2Props) {
  const isLight = ["light", "light-daltonized", "light-ansi"].includes(theme);
  const h = isLight ? '═' : '─';
  const v = isLight ? '║' : '│';
  const tl = isLight ? '╔' : '┌';
  const tr = isLight ? '╗' : '┐';
  const bl = isLight ? '╚' : '└';
  const br = isLight ? '╝' : '┘';

  const borderTop = tl + h.repeat(36) + tr;
  const borderMid = v + ' '.repeat(36) + v;
  const borderBot = bl + h.repeat(36) + br;

  return (
    <Box flexDirection="column" width={WELCOME_V2_WIDTH}>
      <Text>
        <Text color="claude">{welcomeMessage} </Text>
        <Text dimColor={true}>v{MACRO.VERSION}</Text>
      </Text>
      <Text>{h.repeat(WELCOME_V2_WIDTH)}</Text>
      <Text>{" ".repeat(10) + borderTop}</Text>
      <Text>{" ".repeat(10) + borderMid}</Text>
      <Text>{" ".repeat(10) + v + " ".repeat(10) + "C C   N O D E" + " ".repeat(11) + v}</Text>
      <Text>{" ".repeat(10) + borderMid}</Text>
      <Text>{" ".repeat(10) + borderBot}</Text>
      <Text>{h.repeat(WELCOME_V2_WIDTH)}</Text>
    </Box>
  );
}

export function WelcomeV2() {
  const [theme] = useTheme();

  if (env.terminal === "Apple_Terminal") {
    return (
      <AppleTerminalWelcomeV2 theme={theme} welcomeMessage="Welcome to CC Node" />
    );
  }

  const isLight = ["light", "light-daltonized", "light-ansi"].includes(theme);
  const h = isLight ? '═' : '─';
  const v = isLight ? '║' : '│';
  const tl = isLight ? '╔' : '┌';
  const tr = isLight ? '╗' : '┐';
  const bl = isLight ? '╚' : '└';
  const br = isLight ? '╝' : '┘';

  const borderTop = tl + h.repeat(36) + tr;
  const borderMid = v + ' '.repeat(36) + v;
  const borderBot = bl + h.repeat(36) + br;

  return (
    <Box flexDirection="column" width={WELCOME_V2_WIDTH}>
      <Text>
        <Text color="claude">{"Welcome to CC Node"} </Text>
        <Text dimColor={true}>v{MACRO.VERSION}</Text>
      </Text>
      <Text>{h.repeat(WELCOME_V2_WIDTH)}</Text>
      <Text>{" ".repeat(10) + borderTop}</Text>
      <Text>{" ".repeat(10) + borderMid}</Text>
      <Text>{" ".repeat(10) + v + " ".repeat(10) + "C C   N O D E" + " ".repeat(11) + v}</Text>
      <Text>{" ".repeat(10) + borderMid}</Text>
      <Text>{" ".repeat(10) + borderBot}</Text>
      <Text>{h.repeat(WELCOME_V2_WIDTH)}</Text>
    </Box>
  );
}

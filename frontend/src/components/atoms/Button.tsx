import { Button as MuiButton, ButtonProps as MuiButtonProps } from '@mui/material';
import styled from '@emotion/styled';
import { Theme as MuiTheme } from '@mui/material';

interface ButtonProps extends MuiButtonProps {
  isRounded?: boolean;
}

const StyledButton = styled(MuiButton, {
  shouldForwardProp: (prop: string) => prop !== 'isRounded',
})<ButtonProps>(({ theme, isRounded }: { theme: MuiTheme; isRounded?: boolean }) => ({
  borderRadius: isRounded ? '24px' : '8px',
  fontWeight: 600,
  '&.MuiButton-containedPrimary': {
    background: theme.palette.primary.main,
    '&:hover': {
      background: theme.palette.primary.dark,
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    },
  },
  '&.MuiButton-outlinedPrimary': {
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
    '&:hover': {
      background: 'rgba(0, 166, 81, 0.04)',
      transform: 'translateY(-1px)',
    },
  },
}));

const Button = ({ children, isRounded = false, ...props }: ButtonProps) => {
  return (
    <StyledButton isRounded={isRounded} {...props}>
      {children}
    </StyledButton>
  );
};

export default Button; 
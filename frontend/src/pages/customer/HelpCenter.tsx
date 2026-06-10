/**
 * @deprecated Use /help (HelpPage) or /customer/support (SupportHubPage) instead.
 */
import { Navigate } from 'react-router-dom';

export const HelpCenter: React.FC = () => <Navigate to="/help" replace />;

export default HelpCenter;

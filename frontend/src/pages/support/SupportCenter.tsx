/**
 * @deprecated Use /customer/support (SupportHubPage) instead.
 */
import { Navigate } from 'react-router-dom';

export function SupportCenter() {
  return <Navigate to="/customer/support" replace />;
}

export default SupportCenter;

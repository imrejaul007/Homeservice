/**
 * @deprecated Use /contact (ContactPage) instead.
 * This file redirects for backward compatibility.
 */
import { Navigate } from 'react-router-dom';

const ContactUs: React.FC = () => <Navigate to="/contact" replace />;

export default ContactUs;

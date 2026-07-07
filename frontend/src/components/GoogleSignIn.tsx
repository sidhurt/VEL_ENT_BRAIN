import { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID, loginWithGoogle, type Principal } from '../lib/auth';

declare global {
    interface Window { google?: any }
}

// Renders Google's official sign-in button (Google Identity Services).
// On success, exchanges the Google credential for a platform JWT and calls
// onSignIn with the authenticated principal.
export default function GoogleSignIn({ onSignIn }: { onSignIn: (p: Principal) => void }) {
    const buttonRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const init = () => {
            if (!window.google?.accounts?.id || !buttonRef.current) return;
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response: any) => {
                    try {
                        onSignIn(await loginWithGoogle(response.credential));
                    } catch (e: any) {
                        alert('Google sign-in failed: ' + (e.response?.data?.error || e.message));
                    }
                },
            });
            window.google.accounts.id.renderButton(buttonRef.current, {
                theme: 'filled_black',
                size: 'large',
                width: 320,
                text: 'continue_with',
            });
        };

        if (window.google?.accounts?.id) {
            init();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = init;
        document.head.appendChild(script);
    }, []);

    return <div ref={buttonRef} className="flex justify-center" />;
}

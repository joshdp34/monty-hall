import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'The Monty Hall Problem',description:'Play the Monty Hall game and compare shared classroom results.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

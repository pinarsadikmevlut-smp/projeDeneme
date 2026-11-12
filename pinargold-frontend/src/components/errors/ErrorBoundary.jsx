import React from 'react';
export default class ErrorBoundary extends React.Component {
 state={hasError:false};
 static getDerivedStateFromError(){return {hasError:true};}
 componentDidCatch(error,info){console.error('Page rendering failed',error,info.componentStack);}
 componentDidUpdate(previousProps){if(previousProps.resetKey!==this.props.resetKey&&this.state.hasError)this.setState({hasError:false});}
 render(){
  if(this.state.hasError)return <section role="alert" className="glass-panel p-8"><h2 className="font-outfit text-xl font-bold">Bu sayfa yüklenemedi</h2><p className="muted mt-2 text-sm">Diğer modüller kullanılabilir. Sayfayı yeniden deneyin.</p><button className="gold-btn-gradient mt-4 rounded-lg px-4 py-2" onClick={()=>this.setState({hasError:false})}>Tekrar dene</button></section>;
  return this.props.children;
 }
}

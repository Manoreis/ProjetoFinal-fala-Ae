import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Provider as PaperProvider, BottomNavigation } from 'react-native-paper';
import Login from './components/Login';
import Cadastro from './components/Cadastro';
import Conversas from './components/Conversas';
import Mensagens from './components/Mensagens';
import MensagensGrupo from './components/MensagensGrupo'; // Importa o novo componente!
import AdicionarContato from './components/AdicionarContato';
import CriarGrupo from './components/CriarGrupo';
import Perfil from './components/Perfil';
import Solicitacoes from './components/Solicitacoes';

export default function App() {
  const [telaAtual, setTelaAtual] = useState('login');
  const [perfil, setPerfil] = useState(null);
  const [contatoSelecionado, setContatoSelecionado] = useState(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState(null);
  const [aba, setAba] = useState(0);

  function entrarNoSistema(dadosUsuario) {
    setPerfil(dadosUsuario);
    setTelaAtual('tabs');
  }

  function sairDoSistema() {
    setPerfil(null);
    setContatoSelecionado(null);
    setGrupoSelecionado(null);
    setTelaAtual('login');
    setAba(0);
  }

  function irParaCadastro() {
    setTelaAtual('cadastro');
  }

  function voltarParaLogin() {
    setTelaAtual('login');
  }

  // Função para abrir conversa individual ou grupo
  function abrirMensagens(conversa) {
    if (conversa.grupo) {
      setGrupoSelecionado(conversa);
      setContatoSelecionado(null);
      setTelaAtual('mensagensGrupo');
    } else {
      setContatoSelecionado(conversa);
      setGrupoSelecionado(null);
      setTelaAtual('mensagens');
    }
  }

  function voltarParaConversas() {
    setContatoSelecionado(null);
    setGrupoSelecionado(null);
    setTelaAtual('tabs');
  }

  function irParaAdicionarContato() {
    setTelaAtual('adicionarContato');
  }

  function irParaCriarGrupo() {
    setTelaAtual('criarGrupo');
  }

  function irParaPerfil() {
    setTelaAtual('perfil');
  }

  const routes = [
    { key: 'conversas', title: 'Conversas', icon: 'message-text' },
    { key: 'solicitacoes', title: 'Solicitações', icon: 'account-multiple-plus' },
  ];

  const renderScene = ({ route }) => {
    switch (route.key) {
      case 'conversas':
        return (
          <Conversas
            usuario={perfil}
            aoAbrirConversa={abrirMensagens}
            aoAbrirSolicitacoes={() => setAba(1)}
            aoAdicionarContato={irParaAdicionarContato}
            aoCriarGrupo={irParaCriarGrupo}
            aoEditarPerfil={irParaPerfil}
            aoSair={sairDoSistema}
          />
        );
      case 'solicitacoes':
        return (
          <Solicitacoes
            usuarioAtual={perfil}
            aoAbrirConversa={abrirMensagens}
            aoVoltar={() => setAba(0)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <PaperProvider>
      {telaAtual === 'login' && (
        <Login
          aoEntrar={entrarNoSistema}
          irParaCadastro={irParaCadastro}
        />
      )}
      {telaAtual === 'cadastro' && (
        <Cadastro
          aoCadastrar={entrarNoSistema}
          voltarLogin={voltarParaLogin}
        />
      )}
      {telaAtual === 'tabs' && perfil && (
        <BottomNavigation
          navigationState={{ index: aba, routes }}
          onIndexChange={setAba}
          renderScene={renderScene}
        />
      )}
      {telaAtual === 'mensagens' && perfil && contatoSelecionado && (
        <Mensagens
          usuario={perfil}
          contato={contatoSelecionado}
          voltar={voltarParaConversas}
        />
      )}
      {telaAtual === 'mensagensGrupo' && perfil && grupoSelecionado && (
        <MensagensGrupo
          usuario={perfil}
          grupo={grupoSelecionado}
          voltar={voltarParaConversas}
        />
      )}
      {telaAtual === 'adicionarContato' && perfil && (
        <AdicionarContato
          usuarioAtual={perfil}
          aoVoltar={voltarParaConversas}
        />
      )}
      {telaAtual === 'criarGrupo' && perfil && (
        <CriarGrupo
          usuarioAtual={perfil}
          aoVoltar={voltarParaConversas}
        />
      )}
      {telaAtual === 'perfil' && perfil && (
        <Perfil
          usuario={perfil}
          aoVoltar={voltarParaConversas}
        />
      )}
    </PaperProvider>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, padding: 0 }
});
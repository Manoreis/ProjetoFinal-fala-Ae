import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import { database } from '../config/Firebase';

export default function AdicionarContato({ usuarioAtual, aoVoltar }) {
  const [busca, setBusca] = useState('');
  const [feedback, setFeedback] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [processando, setProcessando] = useState(false);

  async function buscarEEnviarSolicitacao() {
    if (!busca.trim()) {
      setFeedback('Digite o nome do usuário!');
      setVisivel(true);
      return;
    }
    setProcessando(true);

    // Busca usuário pelo apelido
    const snap = await database.ref('/usuarios').orderByChild('apelido').equalTo(busca.trim()).once('value');
    if (!snap.exists()) {
      setFeedback('Usuário não encontrado!');
      setVisivel(true);
      setProcessando(false);
      return;
    }

    let idDestinatario = null;
    let apelidoDestinatario = '';
    snap.forEach(child => {
      idDestinatario = child.key;
      apelidoDestinatario = child.val().apelido;
    });

    if (idDestinatario === usuarioAtual.id) {
      setFeedback('Você não pode adicionar a si mesmo!');
      setVisivel(true);
      setProcessando(false);
      return;
    }

    // Verifica se já existe conversa
    const idConversa = [usuarioAtual.id, idDestinatario].sort().join('_');
    const conversaRef = database.ref(`/conversas/${idConversa}`);
    const conversaSnap = await conversaRef.once('value');
    if (conversaSnap.exists()) {
      const apagadaPor = conversaSnap.val().apagadaPor;
      if (apagadaPor && apagadaPor[usuarioAtual.id]) {
        await database.ref(`/conversas/${idConversa}/apagadaPor/${usuarioAtual.id}`).remove();
        setFeedback('Conversa reaberta!');
        setVisivel(true);
        setProcessando(false);
        setBusca('');
        return;
      }
      setFeedback('Você já tem um bate-papo com esse usuário!');
      setVisivel(true);
      setProcessando(false);
      return;
    }

    // Verifica se já existe solicitação pendente
    const solicitacaoRef = database.ref(`/solicitacoes/${idDestinatario}/${usuarioAtual.id}`);
    const solicitacaoSnap = await solicitacaoRef.once('value');
    if (solicitacaoSnap.exists() && solicitacaoSnap.val().status === 'pendente') {
      setFeedback('Já existe uma solicitação pendente para esse usuário!');
      setVisivel(true);
      setProcessando(false);
      return;
    }

    // Cria solicitação de amizade
    await solicitacaoRef.set({
      apelido: usuarioAtual.apelido,
      status: 'pendente'
    });

    setFeedback('Solicitação enviada! Aguarde o contato aceitar.');
    setVisivel(true);
    setProcessando(false);
    setBusca('');
  }

  return (
    <View style={estilos.fundo}>
      <Text style={estilos.titulo}>Adicionar contato</Text>
      <TextInput
        label="Nome do usuário"
        value={busca}
        onChangeText={setBusca}
        style={estilos.campo}
        autoCapitalize="none"
        mode="outlined"
        theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
      />
      <Button
        mode="contained"
        onPress={buscarEEnviarSolicitacao}
        loading={processando}
        style={estilos.botao}
        buttonColor="#2196f3"
        labelStyle={{ color: "#fff" }}
      >
        Buscar e Enviar Pedido
      </Button>
      <Button
        mode="contained"
        onPress={aoVoltar}
        style={estilos.botaoSecundario}
        buttonColor="#232323"
        labelStyle={{ color: "#fff" }}
      >
        Voltar
      </Button>
      <Snackbar
        visible={visivel}
        onDismiss={() => setVisivel(false)}
        duration={2000}
        style={{ backgroundColor: '#232323' }}
        theme={{ colors: { onSurface: '#fff' } }}
      >
        <Text style={{ color: '#fff' }}>{feedback}</Text>
      </Snackbar>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#181818' },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 18, textAlign: 'center', color: '#fff' },
  campo: { marginBottom: 10, backgroundColor: '#232323' },
  botao: { marginBottom: 8, backgroundColor: '#2196f3' },
  botaoSecundario: { marginBottom: 8, backgroundColor: '#232323' }
});
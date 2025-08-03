import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { database } from '../config/Firebase';

export default function Solicitacoes({ usuarioAtual, aoAbrirConversa, aoVoltar }) {
  const [solicitacoes, setSolicitacoes] = useState([]);

  useEffect(() => {
    const ref = database.ref(`/solicitacoes/${usuarioAtual.id}`);
    const atualizar = snap => {
      const dados = snap.val() || {};
      const lista = Object.entries(dados)
        .filter(([_, s]) => s.status === 'pendente')
        .map(([idSolicitante, s]) => ({
          idSolicitante,
          apelido: s.apelido
        }));
      setSolicitacoes(lista);
    };
    ref.on('value', atualizar);
    return () => ref.off('value', atualizar);
  }, [usuarioAtual.id]);

  async function aceitarSolicitacao(solicitante) {
    await database.ref(`/solicitacoes/${usuarioAtual.id}/${solicitante.idSolicitante}`).update({ status: 'aceito' });

    const idConversa = [usuarioAtual.id, solicitante.idSolicitante].sort().join('_');
    const conversaRef = database.ref(`/conversas/${idConversa}/info`);
    const snap = await conversaRef.once('value');
    if (!snap.exists()) {
      await conversaRef.set({
        participantes: [usuarioAtual.id, solicitante.idSolicitante],
        nomes: [usuarioAtual.apelido, solicitante.apelido]
      });
    }

    aoAbrirConversa({
      id: solicitante.idSolicitante,
      apelido: solicitante.apelido
    });
  }

  async function recusarSolicitacao(solicitante) {
    await database.ref(`/solicitacoes/${usuarioAtual.id}/${solicitante.idSolicitante}`).remove();
  }

  function renderItem({ item }) {
    return (
      <Card style={estilos.card}>
        <Card.Content>
          <Text style={{ color: '#fff' }}>{item.apelido} quer conversar com você!</Text>
          <View style={estilos.botoes}>
            <Button
              mode="contained"
              onPress={() => aceitarSolicitacao(item)}
              style={estilos.aceitar}
              buttonColor="#2196f3"
              labelStyle={{ color: '#fff' }}
            >
              ACEITAR
            </Button>
            <Button
              mode="outlined"
              onPress={() => recusarSolicitacao(item)}
              style={estilos.recusar}
              textColor="#e53935"
              labelStyle={{ color: '#e53935' }}
            >
              RECUSAR
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <View style={estilos.fundo}>
      <Text style={estilos.titulo}>Solicitações de conversa</Text>
      <FlatList
        data={solicitacoes}
        renderItem={renderItem}
        keyExtractor={item => item.idSolicitante}
        ListEmptyComponent={<Text style={{ color: '#bbb', textAlign: 'center', marginTop: 40 }}>Nenhuma solicitação pendente.</Text>}
      />
      <Button
        onPress={aoVoltar}
        style={estilos.botaoVoltar}
        buttonColor="#232323"
        labelStyle={{ color: '#fff' }}
      >
        VOLTAR
      </Button>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, padding: 20, backgroundColor: '#181818' },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 18, textAlign: 'center', color: '#fff' },
  card: { marginBottom: 12, backgroundColor: '#181818' },
  botoes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  aceitar: { flex: 1, marginRight: 8, backgroundColor: '#2196f3' },
  recusar: { flex: 1, borderColor: '#e53935', borderWidth: 1, backgroundColor: '#181818' },
  botaoVoltar: { marginTop: 20, backgroundColor: '#232323' }
});
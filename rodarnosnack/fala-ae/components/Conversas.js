import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Appbar, Avatar, TextInput, FAB, List, Text, Portal, Button, Dialog, IconButton, Checkbox, useTheme } from 'react-native-paper';
import { database } from '../config/Firebase';

export default function Conversas({
  usuario,
  aoAbrirConversa,
  aoAbrirSolicitacoes,
  aoAdicionarContato,
  aoCriarGrupo,
  aoEditarPerfil,
  aoSair
}) {
  const [conversas, setConversas] = useState([]);
  const [contatos, setContatos] = useState({});
  const [busca, setBusca] = useState('');
  const [fabMenuVisivel, setFabMenuVisivel] = useState(false);
  const [menuConversaId, setMenuConversaId] = useState(null);
  const [modalLimpar, setModalLimpar] = useState(false);
  const [conversaParaLimpar, setConversaParaLimpar] = useState(null);
  const [limparMensagensMarcado, setLimparMensagensMarcado] = useState(false);
  const [dialogMenuVisivel, setDialogMenuVisivel] = useState(false);
  const [modalPerfilVisivel, setModalPerfilVisivel] = useState(false);
  const [perfilContato, setPerfilContato] = useState(null);
  const theme = useTheme();

  // Atualiza a foto do usuário em tempo real
  useEffect(() => {
    if (!usuario?.id) return;
    const ref = database.ref(`/usuarios/${usuario.id}`);
    const listener = ref.on('value', snap => {
      if (snap.exists()) {
        const dados = snap.val();
        // Atualiza apenas a foto se mudou
        if (dados.fotoUrl && dados.fotoUrl !== usuario.fotoUrl) {
          usuario.fotoUrl = dados.fotoUrl;
        }
        if (dados.status && dados.status !== usuario.status) {
          usuario.status = dados.status;
        }
      }
    });
    return () => ref.off('value', listener);
    // eslint-disable-next-line
  }, [usuario?.id]);

  useEffect(() => {
    const ref = database.ref('/usuarios');
    ref.on('value', snap => {
      setContatos(snap.val() || {});
    });
    return () => ref.off('value');
  }, []);

  useEffect(() => {
    const ref = database.ref('/conversas');
    const atualizar = snap => {
      const dados = snap.val() || {};
      const lista = Object.entries(dados)
        .filter(([id, c]) => {
          // Evita erro se não houver info ou participantes
          if (!c.info || !c.info.participantes) return false;
          if (!c.apagadaPor || !c.apagadaPor[usuario.id]) {
            return true;
          }
          if (c.mensagens) {
            const mensagens = Object.values(c.mensagens);
            const ultima = mensagens[mensagens.length - 1];
            if (ultima && ultima.idAutor && ultima.idAutor !== usuario.id) {
              database.ref(`/conversas/${id}/apagadaPor/${usuario.id}`).remove();
              return true;
            }
          }
          return false;
        })
        .map(([id, c]) => {
          if (!c.info || !c.info.participantes) return null;
          const isGrupo = !!c.info.grupo;
          let idOutro = null;
          let apelidoOutro = null;
          if (!isGrupo && c.info.participantes.length === 2) {
            idOutro = c.info.participantes.find(pid => pid !== usuario.id);
            apelidoOutro = c.info.nomes ? c.info.nomes.find(n => n !== usuario.apelido) || c.info.nomes[0] : '';
          }
          let mensagensVisiveis = [];
          if (c.mensagens) {
            mensagensVisiveis = Object.values(c.mensagens).filter(
              m => !m.apagadaPor || !m.apagadaPor[usuario.id]
            );
          }
          return {
            id,
            idContato: idOutro,
            apelidoContato: apelidoOutro,
            nome: isGrupo ? c.info.nomeGrupo || 'Grupo' : (apelidoOutro || 'Grupo'),
            fotoUrl: isGrupo ? c.info.fotoGrupo || null : (idOutro && contatos[idOutro]?.fotoUrl ? contatos[idOutro].fotoUrl : null),
            statusContato: isGrupo ? '' : (idOutro && contatos[idOutro]?.status ? contatos[idOutro].status : ''),
            ultimaMensagem: mensagensVisiveis.length > 0 ? mensagensVisiveis[mensagensVisiveis.length - 1].conteudo : '',
            horario: mensagensVisiveis.length > 0 ? mensagensVisiveis[mensagensVisiveis.length - 1].horario : null,
            grupo: isGrupo,
            participantes: c.info.participantes,
            nomes: c.info.nomes,
            info: c.info // importante para MensagensGrupo
          };
        })
        .filter(Boolean); // Remove nulls
      setConversas(lista);
    };
    ref.on('value', atualizar);
    return () => ref.off('value', atualizar);
  }, [usuario.id, usuario.apelido, contatos]);

  const conversasFiltradas = conversas.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  async function limparMensagensParaMimEFechar(conversa) {
    const mensagensRef = database.ref(`/conversas/${conversa.id}/mensagens`);
    const snap = await mensagensRef.once('value');
    if (snap.exists()) {
      const updates = {};
      snap.forEach(child => {
        updates[`${child.key}/apagadaPor/${usuario.id}`] = true;
      });
      await mensagensRef.update(updates);
    }
    await database.ref(`/conversas/${conversa.id}/apagadaPor/${usuario.id}`).set(true);
    setMenuConversaId(null);
    setModalLimpar(false);
    setConversaParaLimpar(null);
    setLimparMensagensMarcado(false);
    setConversas(prev => prev.filter(c => c.id !== conversa.id));
  }

  async function fecharConversaParaMim(conversa) {
    await database.ref(`/conversas/${conversa.id}/apagadaPor/${usuario.id}`).set(true);
    setMenuConversaId(null);
    setModalLimpar(false);
    setConversaParaLimpar(null);
    setLimparMensagensMarcado(false);
    setConversas(prev => prev.filter(c => c.id !== conversa.id));
  }

  async function abrirPerfilContato(idContato) {
    if (!idContato) return;
    const snap = await database.ref(`/usuarios/${idContato}`).once('value');
    setPerfilContato(snap.val());
    setModalPerfilVisivel(true);
  }

  function renderAvatar(fotoUrl, size = 36) {
    if (fotoUrl) {
      return (
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#444',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <Image
            source={{ uri: fotoUrl }}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: '#444'
            }}
            resizeMode="cover"
          />
        </View>
      );
    }
    return (
      <Avatar.Icon
        size={size}
        icon="account"
        style={{ backgroundColor: '#444' }}
        color="#fff"
      />
    );
  }

  function renderItem({ item }) {
    return (
      <TouchableOpacity
        onPress={() => {
          if (item.grupo) {
            aoAbrirConversa(item); // item já tem info do grupo
          } else {
            aoAbrirConversa({
              id: item.idContato,
              apelido: item.apelidoContato,
              fotoUrl: contatos[item.idContato]?.fotoUrl || null,
              status: contatos[item.idContato]?.status || ''
            });
          }
        }}
        onLongPress={() => setMenuConversaId(item.id)}
        activeOpacity={0.7}
      >
        <View>
          <List.Item
            title={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{item.nome}</Text>
                {item.statusContato ? (
                  <Text style={{ color: '#bbb', fontSize: 12, marginLeft: 8, marginTop: 2 }}>{item.statusContato}</Text>
                ) : null}
              </View>
            }
            description={item.ultimaMensagem}
            left={props => renderAvatar(item.fotoUrl)}
            right={props => item.grupo ? <List.Icon {...props} icon="account-group" /> : null}
            style={{ backgroundColor: '#181818' }}
            descriptionStyle={{ color: '#bbb' }}
          />
          {menuConversaId === item.id && (
            <View style={estilos.menuLixeiraConversa}>
              {item.idContato && (
                <IconButton
                  icon="account"
                  color="#2196f3"
                  size={24}
                  style={{ backgroundColor: '#232323', borderRadius: 20 }}
                  onPress={() => abrirPerfilContato(item.idContato)}
                />
              )}
              <IconButton
                icon="delete"
                color="#2196f3"
                size={24}
                style={{ backgroundColor: '#232323', borderRadius: 20 }}
                onPress={() => {
                  setConversaParaLimpar(item);
                  setModalLimpar(true);
                }}
              />
              <Button
                onPress={() => setMenuConversaId(null)}
                color="#2196f3"
                compact
                style={{ backgroundColor: '#232323', marginLeft: 4 }}
                labelStyle={{ color: '#2196f3' }}
              >
                Cancelar
              </Button>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={estilos.container}>
      <Appbar.Header>
        <TouchableOpacity onPress={aoEditarPerfil}>
          {renderAvatar(usuario.fotoUrl, 36)}
        </TouchableOpacity>
        <Appbar.Content
          title={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{usuario.apelido}</Text>
              {usuario.status ? (
                <Text style={{ color: '#bbb', fontSize: 13, marginLeft: 8, marginTop: 2 }}>{usuario.status}</Text>
              ) : null}
            </View>
          }
        />
        <Appbar.Action
          icon="dots-vertical"
          color={theme.colors.text}
          onPress={() => setDialogMenuVisivel(true)}
        />
      </Appbar.Header>
      <TextInput
        placeholder="Pesquisar conversa"
        value={busca}
        onChangeText={setBusca}
        style={estilos.campoBusca}
        left={<TextInput.Icon name="magnify" />}
        theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
      />
      <FlatList
        data={conversasFiltradas.sort((a, b) => (b.horario || 0) - (a.horario || 0))}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#bbb' }}>Nenhuma conversa encontrada.</Text>}
        style={{ backgroundColor: '#181818' }}
      />
      <Portal>
        <Dialog visible={modalPerfilVisivel} onDismiss={() => setModalPerfilVisivel(false)}>
          <Dialog.Title>Perfil</Dialog.Title>
          <Dialog.Content>
            {perfilContato && (
              <View style={{ alignItems: 'center' }}>
                {renderAvatar(perfilContato.fotoUrl, 80)}
                <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 4, color: '#fff' }}>{perfilContato.apelido}</Text>
                {perfilContato.status ? (
                  <Text style={{ color: '#bbb', marginBottom: 4 }}>{perfilContato.status}</Text>
                ) : null}
                <Text style={{ color: '#bbb', textAlign: 'center' }}>{perfilContato.sobre || ''}</Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setModalPerfilVisivel(false)} color="#2196f3" labelStyle={{ color: '#2196f3' }}>Fechar</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={dialogMenuVisivel} onDismiss={() => setDialogMenuVisivel(false)}>
          <Dialog.Title>Opções</Dialog.Title>
          <Dialog.Content>
            <Button onPress={() => { setDialogMenuVisivel(false); aoEditarPerfil(); }} color="#2196f3" labelStyle={{ color: '#2196f3' }}>Editar Perfil</Button>
            <Button onPress={() => { setDialogMenuVisivel(false); aoAbrirSolicitacoes(); }} color="#2196f3" labelStyle={{ color: '#2196f3' }}>Solicitações</Button>
            <Button onPress={() => { setDialogMenuVisivel(false); aoSair(); }} color="#2196f3" labelStyle={{ color: '#2196f3' }}>Sair</Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogMenuVisivel(false)} color="#2196f3" labelStyle={{ color: '#2196f3' }}>Fechar</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={modalLimpar} onDismiss={() => { setModalLimpar(false); setConversaParaLimpar(null); setLimparMensagensMarcado(false); }}>
          <Dialog.Title>Opções da conversa</Dialog.Title>
          <Dialog.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Checkbox
                status={limparMensagensMarcado ? 'checked' : 'unchecked'}
                onPress={() => setLimparMensagensMarcado(!limparMensagensMarcado)}
                color="#2196f3"
              />
              <Text style={{ color: '#fff' }}>Limpar todas as mensagens para mim</Text>
            </View>
            <Text style={{ color: '#bbb' }}>
              Marque para limpar todas as mensagens desta conversa apenas para você. O outro usuário continuará vendo normalmente.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setModalLimpar(false); setConversaParaLimpar(null); setLimparMensagensMarcado(false); }} color="#2196f3" labelStyle={{ color: '#2196f3' }}>
              Cancelar
            </Button>
            <Button
              onPress={() => {
                if (limparMensagensMarcado) {
                  limparMensagensParaMimEFechar(conversaParaLimpar);
                } else {
                  fecharConversaParaMim(conversaParaLimpar);
                }
              }}
              color="#2196f3"
              labelStyle={{ color: '#2196f3' }}
            >
              Confirmar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <FAB
        style={[estilos.fab, { backgroundColor: "#2196f3" }]}
        icon="plus"
        color="#fff"
        onPress={() => setFabMenuVisivel(true)}
        label=""
      />
      <Portal>
        <Dialog
          visible={fabMenuVisivel}
          onDismiss={() => setFabMenuVisivel(false)}
        >
          <Dialog.Title></Dialog.Title>
          <Dialog.Content>
            <Button
              icon="account-plus"
              mode="contained"
              style={estilos.fabMenuBotao}
              color="#2196f3"
              labelStyle={{ color: "#fff" }}
              onPress={() => {
                setFabMenuVisivel(false);
                aoAdicionarContato();
              }}
            >
              Adicionar contato
            </Button>
            <Button
              icon="account-group"
              mode="contained"
              style={estilos.fabMenuBotao}
              color="#2196f3"
              labelStyle={{ color: "#fff" }}
              onPress={() => {
                setFabMenuVisivel(false);
                aoCriarGrupo();
              }}
            >
              Criar grupo
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFabMenuVisivel(false)} color="#2196f3" labelStyle={{ color: '#2196f3' }}>Fechar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  campoBusca: { margin: 12, marginBottom: 0, backgroundColor: '#232323', color: '#fff' },
  fab: { position: 'absolute', right: 24, bottom: 24 },
  fabMenuBotao: {
    marginBottom: 10,
    backgroundColor: '#2196f3'
  },
  menuLixeiraConversa: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232323',
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 8,
    marginLeft: 16,
    marginBottom: 4
  }
});
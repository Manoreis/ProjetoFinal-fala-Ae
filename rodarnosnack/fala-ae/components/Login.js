import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import { database, auth } from '../config/Firebase';

export default function Login({ aoEntrar, irParaCadastro }) {
  const [email, setEmail] = useState('');
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [aviso, setAviso] = useState('');
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [emailRec, setEmailRec] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function autenticar() {
    if (!email || !senhaDigitada) {
      setAviso('Preencha e-mail e senha!');
      setMostrarAviso(true);
      return;
    }
    try {
      await auth.signInWithEmailAndPassword(email, senhaDigitada);
      // Busca dados extras do usuário pelo e-mail
      const snap = await database.ref('/usuarios').orderByChild('email').equalTo(email).once('value');
      if (!snap.exists()) {
        setAviso('Usuário não cadastrado!');
        setMostrarAviso(true);
        return;
      }
      let usuario = null;
      snap.forEach(item => {
        usuario = { id: item.key, ...item.val() };
      });
      aoEntrar(usuario);
    } catch (e) {
      setAviso('E-mail ou senha inválidos!');
      setMostrarAviso(true);
    }
  }

  async function enviarRecuperacao() {
    if (!emailRec) {
      setAviso('Digite o e-mail para recuperar!');
      setMostrarAviso(true);
      return;
    }
    setEnviando(true);
    try {
      await auth.sendPasswordResetEmail(emailRec);
      setAviso('E-mail de redefinição enviado!');
      setMostrarAviso(true);
      setRecuperando(false);
      setEmailRec('');
    } catch (e) {
      setAviso('Erro ao enviar e-mail: ' + e.message);
      setMostrarAviso(true);
    }
    setEnviando(false);
  }

  function limparTudo() {
    setEmail('');
    setSenhaDigitada('');
  }

  return (
    <View style={estilos.fundo}>
      <View style={estilos.logoContainer}>
        <Image
          source={require('../assets/logo.png')}
          style={estilos.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={estilos.titulo}>Login</Text>
      {!recuperando ? (
        <>
          <TextInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            style={estilos.campo}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
          />
          <TextInput
            label="Senha"
            value={senhaDigitada}
            onChangeText={setSenhaDigitada}
            secureTextEntry
            style={estilos.campo}
            mode="outlined"
            theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
          />
          <Button mode="contained" onPress={autenticar} style={estilos.botao} buttonColor="#2196f3" labelStyle={{ color: '#fff' }}>
            Acessar
          </Button>
          <Button mode="contained" onPress={limparTudo} style={estilos.botaoSecundario} buttonColor="#232323" labelStyle={{ color: '#fff' }}>
            Limpar
          </Button>
          <Button mode="contained" onPress={irParaCadastro} style={estilos.botaoSecundario} buttonColor="#232323" labelStyle={{ color: '#fff' }}>
            Criar conta
          </Button>
          <Button mode="contained" onPress={() => setRecuperando(true)} style={estilos.botaoSecundario} buttonColor="#232323" labelStyle={{ color: '#fff' }}>
            Esqueci minha senha
          </Button>
        </>
      ) : (
        <>
          <TextInput
            label="E-mail para recuperação"
            value={emailRec}
            onChangeText={setEmailRec}
            style={estilos.campo}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
          />
          <Button mode="contained" onPress={enviarRecuperacao} loading={enviando} style={estilos.botao} buttonColor="#2196f3" labelStyle={{ color: '#fff' }}>
            Enviar e-mail de recuperação
          </Button>
          <Button mode="contained" onPress={() => setRecuperando(false)} style={estilos.botaoSecundario} buttonColor="#232323" labelStyle={{ color: '#fff' }}>
            Voltar
          </Button>
        </>
      )}
      <Snackbar
        visible={mostrarAviso}
        onDismiss={() => setMostrarAviso(false)}
        duration={2000}
        style={{ backgroundColor: '#232323' }}
        theme={{ colors: { onSurface: '#fff' } }}
      >
        <Text style={{ color: '#fff' }}>{aviso}</Text>
      </Snackbar>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#181818' },
  logoContainer: { alignItems: 'center', marginBottom: 60, flexDirection: 'row', justifyContent: 'center' },
  logo: { width: 150, height: 150, marginRight: 8 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 18, textAlign: 'center', color: '#fff' },
  campo: { marginBottom: 10, backgroundColor: '#232323' },
  botao: { marginBottom: 8, backgroundColor: '#2196f3' },
  botaoSecundario: { marginBottom: 8, backgroundColor: '#232323' }
});
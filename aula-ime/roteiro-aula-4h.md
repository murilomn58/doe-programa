# Roteiro da aula de Planejamento de Experimentos

Instituto Militar de Engenharia, programa de mestrado.
Duração: 4 horas, com dois intervalos de 10 minutos.
Documento de uso do professor. Não distribuir aos alunos.

---

## Ideia central da aula

Os alunos precisam sair da sala com três coisas, nesta ordem de importância:

1. A convicção de que a quantidade de ensaios de uma pesquisa é uma decisão de projeto, e não uma consequência do improviso.
2. A capacidade de montar uma matriz fatorial 2², calcular os efeitos à mão e decidir se um efeito é real ou é ruído.
3. A plataforma instalada no navegador, com um experimento próprio já analisado.

Tudo o mais é apoio. Se o tempo apertar, o que se corta é teoria de superfície de resposta, nunca o bloco de conta no quadro nem o bloco prático.

O tom da primeira hora é de conversa. A aula não começa com definição de fator e nível; começa com a turma reconhecendo o próprio problema. Quem chega definindo terminologia perde a sala.

---

## Antes da aula

Na véspera:

- Testar o projetor e o cabo. Levar adaptador HDMI e USB-C.
- Confirmar que existe rede sem fio na sala e obter a senha antes, não na hora.
- Abrir `https://research.iacommurilo.com.br` no notebook da aula e deixar o motor científico carregado. O primeiro carregamento baixa o Python compilado para o navegador e leva cerca de um minuto; depois disso fica salvo.
- Baixar os cinco cadernos em PDF para o notebook e para um pendrive.
- Copiar `case-solo-fibra-cimento.csv` e `case-solo-fibra-cimento.xlsx` para o pendrive.
- Imprimir cinco cópias do enunciado do desafio, para o caso de a rede cair.
- Levar o prêmio.

No dia, quinze minutos antes:

- Escrever no quadro, no canto, o endereço `research.iacommurilo.com.br` e pedir que abram já na chegada. Isso resolve o carregamento inicial enquanto a aula corre, e evita trinta pessoas esperando o mesmo download às 16h.
- Deixar o quadro limpo. O bloco de 65 a 110 minutos precisa de espaço para uma tabela de quatro linhas e três colunas de contas ao lado.

---

## Bloco 1. Abertura (0 a 15 minutos)

Objetivo: estabelecer que quem está falando esteve no laboratório. Sem isso, o resto da aula soa a curso de estatística.

Contar, sem slides longos:

- Formação e o mestrado em curso no IME, com o tema de pesquisa.
- O trabalho com solo-fibra-cimento: o que é o material, para que serve, por que fibra vegetal.
- A viagem a Manaus para coletar a fibra. A quantidade que coube no voo. O fato de que aquele material define quantos corpos de prova existem, e portanto define a pesquisa inteira.
- A plataforma que está sendo construída, e por que ela nasceu de uma dor própria e não de uma ideia de produto.

Fechar o bloco com a pergunta que abre o próximo: quantos de vocês já perderam material num ensaio que não deu em nada.

---

## Bloco 2. A dor (15 a 40 minutos)

Objetivo: fazer a turma falar. Vinte e cinco minutos é muito tempo para monólogo e pouco para debate solto, então conduzir por cinco perguntas.

Um slide por erro, texto curto, e a pergunta em voz alta:

1. Quem já refez um ensaio porque a amostra ficou tempo demais na estufa.
2. Quem já teve um resultado que não fechou e ninguém no laboratório soube dizer por quê.
3. Quem está variando um parâmetro de cada vez, mantendo os outros fixos.
4. Quem já fez uma bateria grande de ensaios e, ao escrever o capítulo, percebeu que os dados não respondiam à pergunta da dissertação.
5. Quem já teve material perdido por armazenamento, quebra de equipamento ou queda de energia.

Anotar no quadro, num canto, dois ou três casos concretos que a turma trouxer. Eles vão ser usados de novo nos blocos 6 e 8. Chamar o caso pelo nome do aluno ao retomar é o que transforma a aula em conversa.

O fechamento do bloco é uma afirmação, e ela precisa ser dita com clareza: nenhuma dessas situações é falta de cuidado no laboratório. Todas são falta de planejamento antes do laboratório.

---

## Bloco 3. O que é planejar um experimento (40 a 55 minutos)

Slides mais quadro. Ritmo rápido, porque é vocabulário.

- Fator, nível e resposta. Usar o próprio solo-fibra-cimento: fatores são teor de cimento, teor de fibra e tipo de fibra; níveis são os valores que cada um assume; resposta é a resistência medida.
- Fator quantitativo e fator qualitativo. Tipo de fibra é qualitativo, e isso muda o que se pode concluir.
- A hipótese de pesquisa vem antes. Não se planeja um experimento sem saber o que se quer descobrir.
- Por que variar um fator de cada vez falha. Desenhar no quadro as curvas de nível de uma superfície com interação e mostrar a busca sequencial parando fora do ótimo. Esta figura é o argumento mais forte da aula e vale a pena desenhá-la à mão, devagar.

Fechar com as quatro perguntas que antecedem qualquer campanha experimental: quais ensaios, quantas réplicas, quais variáveis variar, em quantos níveis.

---

## Intervalo (55 a 65 minutos)

Pedir que quem ainda não abriu a plataforma abra agora.

---

## Bloco 4. Fatorial no quadro (65 a 110 minutos)

Este é o centro da aula. Quarenta e cinco minutos, tudo no quadro, com a turma acompanhando no papel. Nenhum slide além da tabela de dados.

Dados a usar, do material do prof. Peixoto, rendimento de reação em porcentagem:

| Ensaio | Temperatura (K) | Catalisador | Rendimento | Média | Variância |
|---|---|---|---|---|---|
| 1 | 313 | A | 57 e 61 | 59 | 8 |
| 2 | 333 | A | 92 e 88 | 90 | 8 |
| 3 | 313 | B | 55 e 53 | 54 | 2 |
| 4 | 333 | B | 66 e 70 | 68 | 8 |

Sequência no quadro:

1. Montar a matriz com os sinais. Mostrar que quatro ensaios cobrem todas as combinações de dois fatores em dois níveis.
2. Codificar em mais um e menos um. Escrever a fórmula e aplicá-la à temperatura, para ficar claro que é uma mudança de escala e nada mais.
3. Calcular o efeito da temperatura como diferença entre a média dos ensaios em nível alto e a média dos ensaios em nível baixo. Resultado: 22,5.
4. Calcular o efeito do catalisador do mesmo jeito. Resultado: menos 13,5.
5. Calcular a interação. Este é o passo que a turma não conhece, então ir devagar: a interação é a metade da diferença entre o efeito da temperatura com o catalisador A e o efeito da temperatura com o catalisador B. Resultado: menos 8,5.
6. Perguntar à turma: esses três números são reais ou são ruído do laboratório. Deixar a pergunta no ar por um instante antes de continuar.
7. Calcular a variância combinada a partir das variâncias de cada ensaio. Resultado: 6,5. Explicar que essa é a única estimativa de erro que existe, e que ela só existe porque cada ensaio foi repetido.
8. Calcular o erro do efeito. Resultado: 1,80.
9. Montar o intervalo de cada efeito. Nenhum dos três contém zero, portanto os três são reais. Escrever ao lado o que aconteceria se o intervalo contivesse zero.
10. Fechar com a afirmação: sem réplica não existe o passo 7, e sem o passo 7 não existe o passo 9. Quem não replica não tem como saber se o efeito que encontrou é do material ou do laboratório.

Se sobrar tempo neste bloco, acrescentar o terceiro fator e mostrar que oito ensaios dão sete efeitos. Se faltar, cortar isso, não os passos 6 a 10.

---

## Bloco 5. Ler a saída de um software (110 a 140 minutos)

Objetivo: fazer a ponte entre a conta do quadro e a tela que eles vão encontrar em qualquer programa.

Mostrar, na ordem:

1. A tabela ANOVA dos mesmos dados. Apontar onde está o que já foi calculado à mão: a soma de quadrados de cada fator, os graus de liberdade, o erro puro.
2. O coeficiente e o efeito lado a lado. Explicitar que o efeito é o dobro do coeficiente na escala codificada. É a confusão mais comum na leitura de relatório, e vale trinta segundos explícitos.
3. R². Definir como a fração da variação total que o modelo explica.
4. R² ajustado. Explicar por que ele existe: R² nunca cai quando se acrescenta um termo ao modelo, mesmo um termo inútil, e o ajustado penaliza isso.
5. O par de números que ensina mais que qualquer definição, de um relatório real de OriginPro sobre dados de solo-fibra-cimento: R² igual a 0,34 e R² ajustado igual a 0,08. Perguntar à turma o que esse modelo explica. Resposta: praticamente nada. Contrastar com o outro relatório da mesma pesquisa, com R² igual a 0,88 e ajustado igual a 0,79.
6. O valor-p, em linguagem direta, e por que 0,05 é convenção e não lei da natureza.
7. O gráfico de Pareto dos efeitos. Explicar o efeito padronizado, a ordenação por magnitude, e a linha vertical de significância.

Fechar o bloco com a tabela comparativa de ferramentas, abaixo. Apresentá-la com honestidade: o OriginPro é maduro e faz muito mais do que planejamento de experimentos. O argumento da plataforma é acesso e orientação, não superioridade de recursos.

| Critério | Excel | OriginPro | Plataforma |
|---|---|---|---|
| Custo | licença Office | licença anual por usuário | grátis na versão beta |
| Instalação | já instalado | instalação e licença | navegador, sem instalação |
| Geração da matriz de ensaios | manual | assistente próprio | assistente guiado |
| Fracionado, CCD, Box-Behnken, Taguchi | manual | sim | sim |
| ANOVA com falta de ajuste e erro puro | fórmulas escritas à mão | sim | sim |
| Pareto de efeitos e diagnósticos de resíduo | manual | sim | sim |
| Otimização com profiler | não | sim | sim |
| Onde os dados ficam | arquivo local | arquivo local | navegador do usuário |
| Figuras prontas para publicação | não | sim | sim, 600 DPI |
| Curva de aprendizado | baixa para a planilha, alta para a estatística | alta | guiada, com explicação a cada passo |
| Evolução prevista | nenhuma | versões anuais | fluxo completo de pesquisa, do planejamento ao texto do artigo |

---

## Bloco 6. Réplicas e material escasso (140 a 155 minutos)

Retomar os casos que a turma trouxe no bloco 2.

Classificar os erros em três tipos e dizer o que cada um exige:

- Erro grosseiro. Anotação trocada, corpo de prova errado, equipamento fora de faixa. Não se trata com estatística, trata-se com procedimento.
- Erro sistemático. A estufa desregulada que seca todas as amostras de uma bateria a mais, a queda de energia durante a secagem, o armário mais úmido onde um lote ficou guardado. Réplica não corrige, porque o desvio é o mesmo em todas as repetições. Corrige-se com aleatorização da ordem de execução e com blocagem.
- Erro aleatório. A variação de moldagem, a segregação no quarteamento, a leitura do operador. Réplica dilui, porque a variância da média cai com o número de repetições.

Escrever no quadro a relação entre a variância da média e o número de réplicas, e mostrar numericamente o que acontece com o intervalo do efeito quando se passa de uma para duas repetições.

Depois, o custo. Replicar todas as condições consome em torno de setenta por cento do esforço experimental. Daí a ideia de replicar só onde a informação é maior.

Fechar com a restrição real: quando o material é contado, o número de ensaios não é uma escolha, é um dado do problema. Voltar à fibra de Manaus. Perguntar à turma quanto material cada um tem e quantos corpos de prova isso dá.

---

## Intervalo (155 a 165 minutos)

Formar as equipes agora, de duas ou três pessoas, para não gastar tempo do bloco seguinte com organização. Pedir que cada equipe tenha ao menos um notebook com a plataforma já carregada.

---

## Bloco 7. Mãos na plataforma (165 a 200 minutos)

Primeiro momento prático. Objetivo: todos conseguirem ir da definição dos fatores até a tabela ANOVA sozinhos.

Instrução às equipes, escrita no quadro:

1. Abrir a plataforma e escolher o assistente guiado.
2. Quem tiver dados de um ensaio próprio, usar os próprios dados pelo caminho de quem já tem resultados.
3. Quem não tiver dados à mão, abrir o exemplo pronto.
4. Chegar até a tabela ANOVA e ao gráfico de efeitos.
5. Responder, por escrito: quais fatores são significativos, qual o R² e o R² ajustado, e o modelo explica bem o fenômeno.

O professor circula. Não resolver pela equipe; perguntar o que ela já tentou. Recolher, enquanto circula, dois ou três casos interessantes para comentar com a sala inteira nos últimos cinco minutos do bloco.

Ponto de atenção: se alguma equipe estiver com o carregamento do motor travado, é rede. Passar o pendrive com os PDFs e pedir que se juntem a outra equipe. Não parar a aula por isso.

---

## Bloco 8. Desafio (200 a 230 minutos)

Segundo momento prático, agora com competição. Todas as equipes participam.

Distribuir `case-solo-fibra-cimento.csv`, por pendrive e por rede.

Enunciado, escrito no quadro:

> Um estudo de solo-fibra-cimento variou o teor de cimento entre 3 e 9 por cento em massa e o teor de fibra entre 0,25 e 1,75 por cento em massa, medindo a resistência à compressão aos 28 dias. Foram executados onze ensaios, segundo um planejamento composto central. Determine o teor de cimento e o teor de fibra que maximizam a resistência.

Instruções:

1. Carregar os dados na plataforma pelo caminho de quem já tem resultados.
2. Ajustar primeiro o modelo linear. Observar o diagnóstico.
3. Ajustar o modelo com termos quadráticos. Comparar R², R² ajustado e falta de ajuste.
4. Usar o profiler para localizar o ponto ótimo.
5. Anotar num papel o par de valores, com uma casa decimal, e o nome da equipe.

Deixar vinte minutos de trabalho. Nos últimos dez, recolher as respostas, escrever todas no quadro, revelar o ótimo verdadeiro e premiar a equipe mais próxima. A tolerância aceita e o critério de desempate estão no gabarito.

Ao conferir as respostas, olhar o teor de cimento primeiro. O ótimo de fibra cai perto do centro da faixa, de modo que quase qualquer resposta acerta a fibra; é o cimento que separa quem ajustou a superfície de quem apenas apontou o melhor ensaio da tabela.

Dois pontos didáticos na revelação, e eles importam mais que o prêmio.

O primeiro: o melhor ensaio realizado não é o ponto ótimo. O ensaio de maior resistência do conjunto tem 8,83 por cento de cimento, e o ótimo está em 7,6. Quem respondeu pelo melhor ensaio errou por mais de um ponto percentual, e teria mandado a fábrica gastar cimento a mais para produzir menos resistência. É preciso a superfície para enxergar entre os pontos executados, e essa é a razão de existir do método.

O segundo: quem parou no modelo linear não encontrou ótimo nenhum, porque um plano não tem máximo dentro da região. Só o modelo com termos quadráticos localiza o ponto. É a demonstração prática de tudo que foi dito no bloco 5.

Se alguma equipe perguntar por que manter o termo de interação, a resposta está nos dados: ele é significativo a menos de um por cento. Remover a interação ainda leva a uma resposta dentro da tolerância, mas está removendo um efeito real.

---

## Bloco 9. Fechamento (230 a 240 minutos)

- Entregar os cinco cadernos, indicando o endereço `research.iacommurilo.com.br` e a seção de material didático.
- Dizer o que cada caderno cobre, em uma frase, para que saibam a qual voltar.
- Deixar o contato aberto para dúvidas de planejamento das próprias pesquisas. Este é o momento em que a plataforma ganha usuários de verdade.
- Pedir uma linha de retorno: o que foi mais útil e o que ficou confuso.

---

## Perguntas prováveis e respostas curtas

**Por que não fazer tudo no Excel.** Dá para fazer, e o caderno 2 mostra como. O problema não é a conta, é o volume: montar a matriz, controlar a codificação, calcular sete efeitos, seus erros e a ANOVA à mão em planilha é onde os erros entram, e eles não avisam quando acontecem.

**Qual a diferença para o Minitab ou o Design-Expert.** São ferramentas maduras e cobrem mais casos. A plataforma cobre o caminho que a maioria das dissertações precisa, roda no navegador sem licença, e explica cada passo em vez de só devolver a tabela.

**Isso vale para ensaio destrutivo.** Vale, e é justamente onde vale mais, porque cada corpo de prova só pode ser usado uma vez e o número de ensaios é finito por construção.

**Quantas réplicas são suficientes.** Não há número universal. A pergunta correta é qual o menor efeito que se quer conseguir detectar, e a partir disso o número de réplicas sai do erro do efeito. O caderno 1 trata disso.

**Posso usar isso com fatores qualitativos.** Pode. Tipo de fibra, tipo de cura e origem do material são fatores qualitativos legítimos. O que muda é que não existe superfície de resposta entre dois níveis qualitativos, então não se fala em ponto ótimo naquele eixo, e sim em comparação entre níveis.

**Meu orientador quer que eu varie um fator de cada vez.** A resposta não é confrontar. É mostrar que o planejamento fatorial responde a mesma pergunta com menos ensaios e ainda detecta interação, e levar a tabela comparativa de número de ensaios. O caderno 5 tem essa tabela.

---

## O que cortar se o tempo apertar

Em ordem de corte:

1. O terceiro fator no bloco 4.
2. A teoria de superfície de resposta do bloco 5, mantendo apenas a menção de que o modelo quadrático existe e será necessária no desafio.
3. O bloco 6 reduzido a dez minutos, mantendo a classificação dos três tipos de erro e cortando a conta da variância da média.

O que não se corta em hipótese alguma: os passos 6 a 10 do bloco 4, o bloco 7 inteiro, e a revelação do bloco 8.

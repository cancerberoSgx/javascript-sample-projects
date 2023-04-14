# uses chroma instead of faiss and RetrievalQA (high level helper)
# https://docs.beam.cloud/getting-started/langchain
# install and run instructions:
# pip3.11 install langchain openai tiktoken chromadb
# python3.11 src/connectDataExample.py

import os
from pathlib import Path

from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain.text_splitter import TextSplitter
# from langchain.vectorstores.faiss import FAISS
from langchain.schema import Document
from langchain.chains.question_answering import load_qa_chain
from langchain.chains import RetrievalQA

from langchain.llms.openai import OpenAI
from langchain.vectorstores.chroma import Chroma

from langchain.document_loaders import TextLoader

openai_api_key = os.environ["OPENAI_API_KEY"]

file_path = Path("assets/transcript3.txt")

# Answer questions about the headlines
def start_conversation(**inputs):
    # Grab the input from the API
    query = inputs["query"]

    with open(file_path) as f:
        saved_file = f.read()
        texts = saved_file.split('\n')
                 
        docs = [Document(page_content=k, metadata={"source": "my_source"}) for i, k in enumerate(texts)]

        embeddings = OpenAIEmbeddings()

        # create the vector store to use as the index
        db = Chroma.from_documents(docs, embeddings)
        # expose this index in a retriever interface
        retriever = db.as_retriever(search_type="similarity", search_kwargs={"k":2})
        # create a chain to answer questions 
        qa = RetrievalQA.from_chain_type(
            llm=OpenAI(), chain_type="stuff", retriever=retriever, return_source_documents=True)

        res = qa({"query": query})
        print(f"Q: {res['query']}\nA: {res['result']}\n")
        return {"pred": res}


if __name__ == "__main__":
    # query = "You are a shopping assistant. What would you recommend to buy as a gift for a 1 year old baby?"
    # start_conversation(query=query)
    # query = "You are a shopping assistant. Could you recommend me a funny toy for 100 dollars?"
    # start_conversation(query=query)
    query = "My friend's baby just born, could you recommend me a gif?"
    start_conversation(query=query)

    # query = "Which phones can I buy with $300?" # for 100Products.txt
    # start_conversation(query=query)
# # loads a large dataset by including only the first N documents so the final prompt feets
# # https://docs.beam.cloud/getting-started/langchain
# # install and run instructions:
# # pip3.11 install langchain openai tiktoken bs4 faiss-cpu
# # python3.11 src/connectDataExample.py

# import os
# import requests
# from pathlib import Path
# from bs4 import BeautifulSoup

# from langchain.embeddings.openai import OpenAIEmbeddings
# from langchain.text_splitter import CharacterTextSplitter
# from langchain.vectorstores.faiss import FAISS

# from langchain.chains.question_answering import load_qa_chain
# from langchain.llms.openai import OpenAI

# openai_api_key = os.environ["OPENAI_API_KEY"]

# file_path = Path("assets/transcript2.txt")
# # file_path = Path("assets/100Products.txt") # fails because of This model's maximum context length is 4097 tokens, however you requested 7381 tokens (7125 in your prompt; 256 for the completion). Please reduce your prompt; or completion length.

# # Answer questions about the headlines
# def start_conversation(**inputs):
#     # Grab the input from the API
#     query = inputs["query"]

#     with open(file_path) as f:
#         saved_file = f.read()
#         # Split the text to conform to maximum number of tokens
#         text_splitter = CharacterTextSplitter(
#             separator="\n",
#             chunk_size=1000,
#             chunk_overlap=200,
#             length_function=len,
#         )

#         texts = text_splitter.split_text(saved_file)
#         embeddings = OpenAIEmbeddings()
#         docsearch = FAISS.from_texts(texts, embeddings)
#         docs = docsearch.similarity_search(query)

#         # print(len(docs))
#         # print(docs[0])

#         model = OpenAI(temperature=0.9);

#         chain = load_qa_chain(
#             model,
#             chain_type="stuff",
#         )
#         res = chain(
#             {"input_documents": docs, "question": query}, return_only_outputs=True
#         )
#         print(res)
#         return {"pred": res}


# if __name__ == "__main__":
#     query = "You are a shopping assistant. What would you recommend to buy as a gift for a 1 year old baby?"
#     start_conversation(query=query)
#     query = "You are a shopping assistant. Could you recommend me a funny toy for 100 dollars?"
#     start_conversation(query=query)

#     # query = "Which phones can I buy with $300?" # for 100Products.txt
#     # start_conversation(query=query)
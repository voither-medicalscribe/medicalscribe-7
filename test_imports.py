"""
Script para testar importações do projeto
"""
import sys

def test_imports():
    """Testa se todas as importações necessárias estão funcionando"""
    imports_ok = True
    
    # Lista de módulos para testar
    modules = [
        'azure.functions',
        'azure.cognitiveservices.speech',
        'pymongo',
        'jwt',
        'msal',
        'openai',
        'azure.keyvault.secrets',
        'azure.identity'
    ]
    
    print("Testando importações...\n")
    
    for module in modules:
        try:
            __import__(module)
            print(f"✓ {module} - OK")
        except ImportError as e:
            print(f"✗ {module} - ERRO: {e}")
            imports_ok = False
    
    print("\n" + "="*50)
    if imports_ok:
        print("Todas as importações estão funcionando!")
    else:
        print("Algumas importações falharam. Execute:")
        print("pip install -r requirements.txt")
    
    return imports_ok

if __name__ == "__main__":
    test_imports()

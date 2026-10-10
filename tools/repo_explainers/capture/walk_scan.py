import importlib.util,sys
def load(s):
    sp=importlib.util.spec_from_file_location('s',f'specs/{s}.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);return m.SPEC
def ios(blocks,path):
    for j,b in enumerate(blocks):
        if 'io' in b: yield path+(j,), b['io']
        if 'cases' in b:
            for k,it in enumerate(b['cases']['items']):
                yield from ios(it['blocks'], path+(j,'c',k))
for s in sys.argv[1:]:
    S=load(s); print('==',s)
    for i,st in enumerate(S['steps']):
        for p,io in ios(st['scene'],(i,)):
            if io.get('cmd'): print(' ',p, io['cmd'][:110], '->', len(io.get('lines',[])),'lines', io.get('verdict',[''])[0] if io.get('verdict') else '')
